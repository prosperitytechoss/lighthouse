import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "../config/env";

/**
 * Application-layer encryption for signal content at rest.
 *
 * A signal is only category/severity/app/time, but that metadata is sensitive
 * (a child + "self-harm" + a timestamp). We encrypt the content fields into a
 * single opaque column so a stolen DB dump/backup leaks nothing readable.
 *
 * Scope (be honest): this protects against a DATABASE breach — ciphertext is
 * useless without the separately-held key. It is NOT end-to-end: the server
 * holds the key and can decrypt, so a full server compromise (or we ourselves)
 * still can. Production hardening (later): KMS-held key + rotation.
 *
 * Algorithm: AES-256-GCM (authenticated). Fresh 12-byte IV per record; the
 * 16-byte auth tag is verified on decrypt, so tampering throws.
 *
 * Stored format (single text column):
 *   v1:<base64(iv)>:<base64(tag)>:<base64(ciphertext)>
 * The version prefix leaves room for key rotation without a schema change.
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = "v1";

// Key is validated as 64 hex chars (32 bytes) in config/env.ts.
const KEY = Buffer.from(env.SIGNAL_ENCRYPTION_KEY, "hex");

/** The plaintext content of a signal — everything sensitive lives here. */
export type SignalContent = {
  category: string;
  severity: string;
  app: string;
  meta?: Record<string, unknown>;
};

/** Encrypt signal content into the opaque column value. */
export function encryptSignalContent(content: SignalContent): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(content), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/** Decrypt an opaque column value back into signal content. Throws if tampered. */
export function decryptSignalContent(payload: string): SignalContent {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Unrecognized signal payload format");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivB64!, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64!, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64!, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as SignalContent;
}
