import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "../config/env";

/**
 * Application-layer encryption for location points at rest.
 *
 * A child's coordinates are the single most sensitive thing this product stores —
 * lat/lng + a timestamp is a movement history. So the actual position NEVER hits
 * the DB in plaintext: we encrypt { lat, lng, accuracy } into one opaque column.
 * A stolen dump/backup leaks no readable location.
 *
 * Scope (honest, same as signal-crypto): this defends against a DATABASE breach —
 * ciphertext is useless without the separately-held key. It is NOT end-to-end:
 * the server holds the key and can decrypt. Production hardening (later): KMS.
 *
 * We deliberately reuse SIGNAL_ENCRYPTION_KEY — it is the app's single
 * data-at-rest key, not a signal-specific secret. One key, one rotation story.
 *
 * Algorithm + format are identical to signal-crypto (AES-256-GCM, 12-byte IV,
 * 16-byte tag, "v1:<iv>:<tag>:<ct>" base64) so the rotation tooling is shared.
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = "v1";

const KEY = Buffer.from(env.SIGNAL_ENCRYPTION_KEY, "hex");

/** The plaintext content of a location point — everything sensitive lives here. */
export type LocationContent = {
  lat: number;
  lng: number;
  /** Horizontal accuracy in metres, if the device reported it. */
  accuracy?: number;
};

/** Encrypt a location point into the opaque column value. */
export function encryptLocationContent(content: LocationContent): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(content), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/** Decrypt an opaque column value back into a location point. Throws if tampered. */
export function decryptLocationContent(payload: string): LocationContent {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Unrecognized location payload format");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivB64!, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64!, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64!, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as LocationContent;
}
