import { randomBytes } from "node:crypto";

import { redis } from "./redis";

// Opaque child-device tokens (long-lived; mirror sessions).
//   devtoken:<token>      -> JSON { deviceId, accountId }
//   device:token:<id>     -> token   (reverse index, for revoke on unpair)
const tokenKey = (token: string) => `devtoken:${token}`;
const indexKey = (deviceId: string) => `device:token:${deviceId}`;

export type DeviceTokenRecord = { deviceId: string; accountId: string };

export async function createDeviceToken(deviceId: string, accountId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await redis.set(tokenKey(token), JSON.stringify({ deviceId, accountId }));
  await redis.set(indexKey(deviceId), token);
  return token;
}

export async function getDeviceToken(token: string): Promise<DeviceTokenRecord | null> {
  const raw = await redis.get(tokenKey(token));
  return raw ? (JSON.parse(raw) as DeviceTokenRecord) : null;
}

/** Revoke a device's token (on unpair). */
export async function revokeDeviceToken(deviceId: string): Promise<void> {
  const token = await redis.get(indexKey(deviceId));
  if (token) await redis.del(tokenKey(token));
  await redis.del(indexKey(deviceId));
}
