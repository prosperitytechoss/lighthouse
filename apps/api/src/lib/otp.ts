import { createHash, randomInt } from "node:crypto";

import { redis } from "./redis";

// 6-digit numeric OTP, stored HASHED in Redis with a 10-min TTL, a max-attempts
// cap, and a per-email resend cooldown. `purpose` namespaces the keys so e.g.
// signup and password-reset codes never collide.
const OTP_TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

// "settings" codes are keyed by ACCOUNT ID, not email — the child-device gate
// for turning email alerts off (the code goes to the parent's inbox).
export type OtpPurpose = "signup" | "reset" | "settings";

const codeKey = (email: string, p: OtpPurpose) => `otp:${p}:code:${email}`;
const attemptsKey = (email: string, p: OtpPurpose) => `otp:${p}:attempts:${email}`;
const cooldownKey = (email: string, p: OtpPurpose) => `otp:${p}:cooldown:${email}`;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Cryptographically-random 6-digit code, zero-padded. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Store the hashed code (overwrites any prior) and reset the attempt counter. */
export async function storeOtp(
  email: string,
  code: string,
  purpose: OtpPurpose = "signup",
): Promise<void> {
  await redis.set(codeKey(email, purpose), hashCode(code), { EX: OTP_TTL_SECONDS });
  await redis.del(attemptsKey(email, purpose));
}

export type OtpResult = "ok" | "expired" | "mismatch" | "too_many_attempts";

/** Verify a submitted code, enforcing the attempt cap. Consumes the OTP on success. */
export async function verifyOtp(
  email: string,
  code: string,
  purpose: OtpPurpose = "signup",
): Promise<OtpResult> {
  const stored = await redis.get(codeKey(email, purpose));
  if (!stored) return "expired";

  const attempts = await redis.incr(attemptsKey(email, purpose));
  if (attempts === 1) await redis.expire(attemptsKey(email, purpose), OTP_TTL_SECONDS);
  if (attempts > MAX_ATTEMPTS) {
    await redis.del([codeKey(email, purpose), attemptsKey(email, purpose)]);
    return "too_many_attempts";
  }

  if (hashCode(code) !== stored) return "mismatch";

  await redis.del([codeKey(email, purpose), attemptsKey(email, purpose)]);
  return "ok";
}

/** Returns true and starts the cooldown if a resend is allowed; false if too soon. */
export async function takeResendSlot(
  email: string,
  purpose: OtpPurpose = "signup",
): Promise<boolean> {
  // NX = only set if absent; returns null when the key already exists (cooling down).
  const set = await redis.set(cooldownKey(email, purpose), "1", {
    EX: RESEND_COOLDOWN_SECONDS,
    NX: true,
  });
  return set === "OK";
}
