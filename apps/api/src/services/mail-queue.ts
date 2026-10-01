import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomUUID } from "node:crypto";
import { UnrecoverableError, type Job } from "bullmq";
import { Resend } from "resend";

import { env } from "../config/env";
import { logger } from "../lib/logger";
import { createQueue, createWorker } from "../lib/queue";

export type Mail = { from: string; to: string; subject: string; text: string; html?: string };
export type MailJob = { payload: string; expiresAt: number };
const key = Buffer.from(hkdfSync("sha256", Buffer.from(env.SIGNAL_ENCRYPTION_KEY, "hex"), "", "lighthouse-mail-v1", 32));

export function sealMail(mail: Mail): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(mail)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function openMail(payload: string): Mail {
  const bytes = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()) as Mail;
}

let queue: ReturnType<typeof createQueue<MailJob>> | undefined;
export const mailQueue = () => queue ??= createQueue<MailJob>("mail");

export async function enqueueMail(mail: Mail, options: { priority?: number; ttlMs?: number } = {}): Promise<void> {
  await mailQueue().add("send", {
    payload: sealMail(mail),
    expiresAt: Date.now() + (options.ttlMs ?? 23 * 3600_000),
  }, {
    jobId: randomUUID(),
    priority: options.priority ?? 5,
    // Drop sensitive payloads once sent. Failed payloads are encrypted and bounded.
    removeOnComplete: true,
    removeOnFail: { age: 86400, count: 1000 },
  });
}

export type DeliverMail = (mail: Mail, idempotencyKey: string) => Promise<void>;
export function mailProcessor(deliver: DeliverMail) {
  return async (job: Job<MailJob>): Promise<void> => {
    if (Date.now() >= job.data.expiresAt) throw new UnrecoverableError("Email expired before delivery");
    let mail: Mail;
    try { mail = openMail(job.data.payload); }
    catch { throw new UnrecoverableError("Invalid encrypted email payload"); }
    await deliver(mail, `lighthouse-mail-${job.id}`);
    logger.info(`[mail] delivered job ${job.id}`);
  };
}

let started = false;
export function startMailWorker(): void {
  if (started || !env.RESEND_API_KEY) return;
  started = true;
  const resend = new Resend(env.RESEND_API_KEY);
  mailQueue();
  createWorker<MailJob>("mail", mailProcessor(async (mail, idempotencyKey) => {
    const { error } = await resend.emails.send(mail, { idempotencyKey });
    if (error) {
      // Provider messages may echo recipients or content. Keep failure logs private.
      throw new Error(`Email provider failure: ${error.name}`);
    }
  }), { concurrency: 2, limiter: { max: 2, duration: 1000 } });
}
