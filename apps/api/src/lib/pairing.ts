import { randomBytes, randomInt } from "node:crypto";

import { redis } from "./redis";

// Single-use pairing handshake, Redis-backed (mirrors the OTP pattern).
//   pairing:<token>     -> JSON { accountId, code, claimed, deviceId? }, 5-min TTL
//   pairing:code:<code> -> token  (manual-entry fallback), same TTL
const PAIRING_TTL_SECONDS = 5 * 60;

const tokenKey = (token: string) => `pairing:${token}`;
const codeKey = (code: string) => `pairing:code:${code}`;

export type PairingRecord = {
  accountId: string;
  code: string;
  claimed: boolean;
  deviceId?: string;
};

export type CreatedPairing = { token: string; code: string; expiresAt: string };

/** Create a single-use pairing token (+ short human code) for an account. */
export async function createPairing(accountId: string): Promise<CreatedPairing> {
  const token = randomBytes(24).toString("hex");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const record: PairingRecord = { accountId, code, claimed: false };
  await redis.set(tokenKey(token), JSON.stringify(record), { EX: PAIRING_TTL_SECONDS });
  await redis.set(codeKey(code), token, { EX: PAIRING_TTL_SECONDS });
  const expiresAt = new Date(Date.now() + PAIRING_TTL_SECONDS * 1000).toISOString();
  return { token, code, expiresAt };
}

export async function getPairing(token: string): Promise<PairingRecord | null> {
  const raw = await redis.get(tokenKey(token));
  return raw ? (JSON.parse(raw) as PairingRecord) : null;
}

/** Resolve a manual-entry code to its token. */
export async function tokenForCode(code: string): Promise<string | null> {
  return redis.get(codeKey(code));
}

/** Mark a pairing claimed by a device. Preserves the remaining TTL for polling. */
export async function markClaimed(token: string, record: PairingRecord, deviceId: string): Promise<void> {
  const updated: PairingRecord = { ...record, claimed: true, deviceId };
  await redis.set(tokenKey(token), JSON.stringify(updated), { KEEPTTL: true });
}
