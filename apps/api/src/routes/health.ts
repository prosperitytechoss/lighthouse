import { Router } from "express";

import { pingDb } from "../db/client";
import { pingRedis } from "../lib/redis";

export const healthRouter = Router();

type Probe = "ok" | "error";

/**
 * Proof of life. Pings Postgres (a trivial query) and Redis (PING) in parallel.
 * Returns 200 only when both are reachable, 503 otherwise.
 */
healthRouter.get("/health", async (_req, res) => {
  const [dbResult, redisResult] = await Promise.allSettled([pingDb(), pingRedis()]);

  const dbOk: Probe = dbResult.status === "fulfilled" && dbResult.value ? "ok" : "error";
  const redisOk: Probe =
    redisResult.status === "fulfilled" && redisResult.value ? "ok" : "error";

  const healthy = dbOk === "ok" && redisOk === "ok";

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    db: dbOk,
    redis: redisOk,
    uptime: process.uptime(),
  });
});
