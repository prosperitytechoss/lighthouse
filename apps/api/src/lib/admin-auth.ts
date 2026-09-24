import { randomBytes } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";

import { getDeviceToken } from "./device-token";
import { redis } from "./redis";
import { getSession } from "./session";

// Admin identity rides on the same opaque-Redis-token pattern as parent sessions,
// but keyed separately and gated by an email allow-list.
declare global {
  namespace Express {
    interface Request {
      adminEmail?: string;
    }
  }
}

const ADMIN_SESSION_TTL = 7 * 24 * 60 * 60;
const MAGIC_TTL = 15 * 60;
const adminKey = (t: string) => `adminsession:${t}`;
const magicKey = (t: string) => `adminmagic:${t}`;

/** Allow-listed admin emails (lowercased) from ADMIN_EMAILS. */
export function adminEmails(): Set<string> {
  return new Set(
    env.ADMIN_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}
export function isAdmin(email: string): boolean {
  return adminEmails().has(email.trim().toLowerCase());
}

export async function createAdminSession(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await redis.set(adminKey(token), email.toLowerCase(), { EX: ADMIN_SESSION_TTL });
  return token;
}
export async function getAdminSession(token: string): Promise<string | null> {
  return redis.get(adminKey(token));
}
export async function destroyAdminSession(token: string): Promise<void> {
  await redis.del(adminKey(token));
}

/** One-time magic-link token → email, 15-min TTL, consumed on use. */
export async function createMagicToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await redis.set(magicKey(token), email.toLowerCase(), { EX: MAGIC_TTL });
  return token;
}
export async function consumeMagicToken(token: string): Promise<string | null> {
  const email = await redis.get(magicKey(token));
  if (email) await redis.del(magicKey(token));
  return email;
}

function bearer(req: Request): string | undefined {
  const h = req.header("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : undefined;
}

/** Gate a route on a valid admin session whose email is still allow-listed. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = bearer(req);
  const email = token ? await getAdminSession(token) : null;
  if (!email || !isAdmin(email)) {
    res.status(401).json({ ok: false, error: "Admin auth required" });
    return;
  }
  req.adminEmail = email;
  next();
}

/**
 * Read-side gate for GET /lexicon + /version: the CHILD app (device token) syncs
 * it, and admins preview it from the dashboard — accept either.
 */
export async function requireDeviceOrAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = bearer(req);
  if (token) {
    const email = await getAdminSession(token);
    if (email && isAdmin(email)) {
      req.adminEmail = email;
      next();
      return;
    }
    const device = await getDeviceToken(token);
    if (device) {
      req.deviceId = device.deviceId;
      req.accountId = device.accountId;
      next();
      return;
    }
    // A parent session may also read it (e.g. a future in-app view).
    const accountId = await getSession(token);
    if (accountId) {
      req.accountId = accountId;
      next();
      return;
    }
  }
  res.status(401).json({ ok: false, error: "Auth required" });
}
