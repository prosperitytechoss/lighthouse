import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

import { db } from "../db/client";
import { devices } from "../db/schema";

import { getDeviceToken, revokeDeviceToken } from "./device-token";
import { getSession } from "./session";

// Augment Express' Request with the authenticated account / device ids.
declare global {
  namespace Express {
    interface Request {
      accountId?: string;
      deviceId?: string;
    }
  }
}

function bearer(req: Request): string | undefined {
  const header = req.header("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : undefined;
}

/** Gate a route on a valid parent session; attaches req.accountId. */
export async function requireParent(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = bearer(req);
  const accountId = token ? await getSession(token) : null;
  if (!accountId) {
    res.status(401).json({ ok: false, error: "Not authenticated" });
    return;
  }
  req.accountId = accountId;
  next();
}

/** Gate a route on a valid child device token; attaches req.deviceId + accountId. */
export async function requireDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = bearer(req);
  const record = token ? await getDeviceToken(token) : null;
  if (!record) {
    res.status(401).json({ ok: false, error: "Device not linked" });
    return;
  }
  // The token lives in Redis but the row is the truth: if the device was wiped
  // (unpair, DB reset), revoke the stale token and 401 so the phone's native
  // uploader stops FK-erroring and the app falls back to onboarding.
  const [row] = await db
    .select({ id: devices.id })
    .from(devices)
    .where(eq(devices.id, record.deviceId))
    .limit(1);
  if (!row) {
    await revokeDeviceToken(record.deviceId);
    res.status(401).json({ ok: false, error: "Device not linked" });
    return;
  }
  req.deviceId = record.deviceId;
  req.accountId = record.accountId;
  next();
}
