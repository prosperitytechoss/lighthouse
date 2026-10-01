import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../config/env";
import { logger } from "./logger";

// A developer using the same Redis must never consume production jobs.
const prefix = `lighthouse-${env.NODE_ENV}`;
let producer: Redis | undefined;
const queues: Queue[] = [];
const workers: Worker[] = [];

function connection(worker: boolean): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
    connectTimeout: 5000,
    ...(worker ? {} : { commandTimeout: 5000 }),
    retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
  });
  client.on("error", () => logger.error(`[queue] ${worker ? "worker" : "producer"} Redis connection error`));
  return client;
}

export function createQueue<T>(name: string): Queue<T> {
  producer ??= connection(false);
  const queue = new Queue<T>(name, {
    connection: producer,
    prefix,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 7 * 86400, count: 1000 },
    },
  });
  queue.on("error", () => logger.error(`[queue:${name}] Redis error`));
  queues.push(queue);
  return queue;
}

const workerConnections: Redis[] = [];
export function createWorker<T>(name: string, processor: Processor<T>, options: Partial<WorkerOptions> = {}): Worker<T> {
  const client = connection(true);
  workerConnections.push(client);
  const worker = new Worker<T>(name, processor, { ...options, connection: client, prefix });
  worker.on("error", () => logger.error(`[queue:${name}] worker error`));
  // Job data can contain credentials and private messages; never log it.
  worker.on("failed", (job) => logger.error(`[queue:${name}] job ${job?.id} failed (attempt ${job?.attemptsMade})`));
  workers.push(worker);
  return worker;
}

export async function readyQueues(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(queues.map((q) => q.waitUntilReady())),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Queue Redis unavailable")), 10_000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function closeQueues(): Promise<void> {
  // Finish workers before closing databases or producers they may still use.
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(queues.map((queue) => queue.close()));
  await Promise.all(workerConnections.map((client) => client.quit()));
  if (producer) await producer.quit();
}

export async function queueStats() {
  return Promise.all(queues.map(async (queue) => ({
    name: queue.name,
    counts: await queue.getJobCounts("waiting", "prioritized", "active", "delayed", "failed"),
  })));
}
