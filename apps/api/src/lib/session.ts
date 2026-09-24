import { randomBytes } from "node:crypto";

import { redis } from "./redis";

// Opaque session tokens in Redis: session:<token> -> accountId.
// A per-account index (set of tokens) lets us revoke every session at once
// (e.g. on password reset). (A refresh/access JWT split can replace this later.)
//
// Sliding expiration: the TTL is long (1 year) AND is refreshed on every use
// (see getSession). So a parent who opens the app at least once a year never
// has to log in again — effectively "never expires" while the app is in use —
// yet a truly abandoned session still eventually cleans up and revocation via
// destroyAllSessions still works.
const SESSION_TTL_SECONDS = 365 * 24 * 60 * 60;
const sessionKey = (token: string) => `session:${token}`;
const accountIndexKey = (accountId: string) => `sessions:account:${accountId}`;

export async function createSession(accountId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await redis.set(sessionKey(token), accountId, { EX: SESSION_TTL_SECONDS });
  await redis.sAdd(accountIndexKey(accountId), token);
  await redis.expire(accountIndexKey(accountId), SESSION_TTL_SECONDS);
  return token;
}

/**
 * Returns the accountId for a valid token, or null. On a hit, the TTL is slid
 * forward (both the session and its account index) so active parents stay
 * signed in indefinitely.
 */
export async function getSession(token: string): Promise<string | null> {
  const accountId = await redis.getEx(sessionKey(token), { EX: SESSION_TTL_SECONDS });
  if (accountId) {
    await redis.expire(accountIndexKey(accountId), SESSION_TTL_SECONDS);
  }
  return accountId;
}

export async function destroySession(token: string): Promise<void> {
  const accountId = await redis.get(sessionKey(token));
  await redis.del(sessionKey(token));
  if (accountId) await redis.sRem(accountIndexKey(accountId), token);
}

/** Revoke every session for an account (force re-login), e.g. after a password reset. */
export async function destroyAllSessions(accountId: string): Promise<void> {
  const tokens = await redis.sMembers(accountIndexKey(accountId));
  const keys = tokens.map(sessionKey);
  if (keys.length) await redis.del(keys);
  await redis.del(accountIndexKey(accountId));
}
