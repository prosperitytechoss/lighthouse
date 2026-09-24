import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";

import { redis } from "./redis";

/** Wrap an async route so thrown/rejected errors reach the centralized handler. */
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
export const ah = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res, next).catch(next);

/** Fixed-window rate limit. Returns true if the call is allowed. */
export async function allowRequest(key: string, limit: number, windowSec: number): Promise<boolean> {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return n <= limit;
}

export function clientIp(req: Request): string {
  const fwd = req.header("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]!.trim() : req.ip) || "unknown";
}

/**
 * Absolute base URL for links we email out. Prefers API_PUBLIC_URL when it is
 * genuinely configured; otherwise derives it from the incoming request (Render
 * sets X-Forwarded-Proto / Host). Without this, an unset env var silently sent
 * parents a localhost confirmation link.
 */
export function publicBaseUrl(req: Request): string {
  const configured = env.API_PUBLIC_URL;
  const isLocal = /localhost|127\.0\.0\.1/.test(configured);
  if (configured && !isLocal) return configured.replace(/\/+$/, "");
  const host = req.get("host");
  if (host && !/localhost|127\.0\.0\.1/.test(host)) return `${req.protocol}://${host}`;
  return configured.replace(/\/+$/, "");
}
