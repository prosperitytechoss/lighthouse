import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import { after, before, test } from "node:test";
import type { Job } from "bullmq";

let redisProcess: ChildProcess;
let directory: string;
let queues: typeof import("../src/lib/queue");
let mail: typeof import("../src/services/mail-queue");

before(async () => {
  // Use a private disposable Redis; never use developer or production settings.
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  directory = await mkdtemp(join(tmpdir(), "lighthouse-queue-test-"));
  redisProcess = spawn("redis-server", ["--bind", "127.0.0.1", "--port", String(port), "--dir", directory, "--save", "", "--appendonly", "no"]);
  await new Promise<void>((resolve, reject) => {
    redisProcess.on("error", reject);
    redisProcess.on("exit", (code) => reject(new Error(`Redis exited: ${code}`)));
    redisProcess.stdout!.on("data", (data) => { if (String(data).includes("Ready to accept connections")) resolve(); });
  });
  Object.assign(process.env, {
    NODE_ENV: "test", REDIS_URL: `redis://127.0.0.1:${port}`,
    DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test",
    SIGNAL_ENCRYPTION_KEY: "01".repeat(32), RESEND_API_KEY: "",
  });
  queues = await import("../src/lib/queue");
  mail = await import("../src/services/mail-queue");
});

after(async () => {
  if (queues) await queues.closeQueues();
  if (redisProcess) {
    const exited = once(redisProcess, "exit");
    redisProcess.kill("SIGTERM");
    await exited;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

const message = { from: "test@example.invalid", to: "parent@example.invalid", subject: "Test", text: "secret verification code 123456" };
async function waitForState(job: Job, state: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await job.getState() === state) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.fail(`Job did not become ${state}: ${await job.getState()}`);
}

test("mail payload is encrypted and tampering is rejected", () => {
  const payload = mail.sealMail(message);
  assert.deepEqual(mail.openMail(payload), message);
  assert(!Buffer.from(payload, "base64").includes(Buffer.from(message.text)));
  const corrupted = Buffer.from(payload, "base64");
  corrupted[30] = corrupted[30]! ^ 1;
  assert.throws(() => mail.openMail(corrupted.toString("base64")));
});

test("mail waits for a worker, retries with the same delivery key, and survives worker replacement", async () => {
  const queue = mail.mailQueue();
  await queues.readyQueues();
  await mail.enqueueMail(message);
  const pending = await queue.getJobs(["prioritized"]);
  assert.equal(pending.length, 1);
  assert.equal(mail.openMail(pending[0]!.data.payload).text, message.text);
  const keys: string[] = [];
  const processor = mail.mailProcessor(async (payload, key) => {
    assert.deepEqual(payload, message);
    keys.push(key);
    if (keys.length === 1) throw new Error("Simulated provider outage");
  });
  // Use a short retry interval for this integration test.
  await pending[0]!.remove();
  const retry = await queue.add("send", { payload: mail.sealMail(message), expiresAt: Date.now() + 60_000 }, { backoff: { type: "exponential", delay: 20 }, removeOnComplete: false });
  const worker = queues.createWorker("mail", processor);
  await waitForState(retry, "completed");
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
  await worker.close();
  const afterRestart = await queue.add("send", { payload: mail.sealMail(message), expiresAt: Date.now() + 60_000 });
  assert.equal(await afterRestart.getState(), "waiting");
  const replacement = queues.createWorker("mail", processor);
  await waitForState(afterRestart, "completed");
  await replacement.close();
});

test("expired credentials are never delivered or retried", async () => {
  const queue = mail.mailQueue();
  let delivered = false;
  const job = await queue.add("send", { payload: mail.sealMail(message), expiresAt: Date.now() - 1 });
  const worker = queues.createWorker("mail", mail.mailProcessor(async () => { delivered = true; }));
  await waitForState(job, "failed");
  assert.equal(delivered, false);
  assert.equal((await queue.getJob(job.id!))!.attemptsMade, 1);
  await worker.close();
});
