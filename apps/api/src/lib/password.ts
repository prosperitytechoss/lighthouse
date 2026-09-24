import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

// @node-rs/argon2 defaults to the argon2id variant with sane OWASP-ish params.
// Prebuilt native bindings, so no compile step.

export function hashPassword(password: string): Promise<string> {
  return argonHash(password);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await argonVerify(storedHash, password);
  } catch {
    return false;
  }
}
