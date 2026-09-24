import { createClient, type RedisClientType } from "redis";

import { env } from "../config/env";

import { logger } from "./logger";

// Managed Redis (Render Key Value etc.) closes idle TLS sockets after a few
// minutes. Keep the connection warm with a periodic PING and reconnect with
// capped backoff — otherwise a dropped socket rejects every in-flight command
// and can take the whole process down (see the unhandledRejection net in index).
export const redis: RedisClientType = createClient({
  url: env.REDIS_URL,
  pingInterval: 4 * 60 * 1000,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 200, 5000),
  },
});

redis.on("error", (err) => logger.error("Redis client error", err));

/** Open the connection (idempotent). Called once at boot. */
export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) await redis.connect();
}

/** Liveness check used by /health. Returns true only on a PONG. */
export async function pingRedis(): Promise<boolean> {
  const reply = await redis.ping();
  return reply === "PONG";
}

/** Graceful shutdown. */
export async function closeRedis(): Promise<void> {
  if (redis.isOpen) await redis.quit();
}
