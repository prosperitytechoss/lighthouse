import { randomBytes } from "node:crypto";

import { redis } from "./redis";

// Opaque email-confirmation tokens in Redis: confirm:<token> -> accountId.
// Tapped from the setup-confirmation email to verify the parent's address.
// Long-ish TTL (7 days) so a parent who checks email later still confirms.
const CONFIRM_TTL_SECONDS = 7 * 24 * 60 * 60;
const confirmKey = (token: string) => `confirm:${token}`;

export async function createConfirmToken(accountId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await redis.set(confirmKey(token), accountId, { EX: CONFIRM_TTL_SECONDS });
  return token;
}

/** Consume a confirm token (single-use), returning its accountId or null. */
export async function consumeConfirmToken(token: string): Promise<string | null> {
  const key = confirmKey(token);
  const accountId = await redis.get(key);
  if (accountId) await redis.del(key);
  return accountId;
}
