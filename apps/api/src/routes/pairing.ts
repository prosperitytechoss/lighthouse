import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { db } from "../db/client";
import { accounts, devices } from "../db/schema";
import { requireParent } from "../lib/auth-middleware";
import { createDeviceToken, revokeDeviceToken } from "../lib/device-token";
import { ah, allowRequest, clientIp } from "../lib/http";
import { createPairing, getPairing, markClaimed, tokenForCode } from "../lib/pairing";

export const pairingRouter = Router();

// POST /pairing/create — parent generates a single-use pairing token + QR payload.
pairingRouter.post(
  "/create",
  requireParent,
  ah(async (req, res) => {
    const { token, code, expiresAt } = await createPairing(req.accountId!);
    res.json({ ok: true, pairingToken: token, code, expiresAt });
  }),
);

// POST /pairing/claim — child redeems the token (unauth; gated by the token itself).
const ClaimBody = z.object({
  pairingToken: z.string().min(10).max(200).optional(),
  code: z.string().trim().regex(/^\d{6}$/).optional(),
  deviceInfo: z
    .object({
      model: z.string().max(120).optional(),
      manufacturer: z.string().max(120).optional(),
      os: z.string().max(120).optional(),
    })
    .optional(),
  installId: z.string().min(8).max(200).optional(),
});
pairingRouter.post(
  "/claim",
  ah(async (req, res) => {
    // Light abuse guard (tokens are unguessable; this just caps spray).
    if (!(await allowRequest(`pairclaim:${clientIp(req)}`, 30, 60))) {
      return res.status(429).json({ ok: false, error: "Too many attempts. Try again shortly." });
    }

    const body = ClaimBody.parse(req.body);
    const token = body.pairingToken ?? (body.code ? await tokenForCode(body.code) : null);
    if (!token) return res.status(400).json({ ok: false, error: "Invalid or expired pairing code." });

    const record = await getPairing(token);
    if (!record) return res.status(400).json({ ok: false, error: "This pairing code has expired." });
    if (record.claimed) return res.status(409).json({ ok: false, error: "This code has already been used." });

    // Dedupe: if this physical device (same installId) is already linked to this
    // account, reuse its row instead of creating a duplicate. Re-issue the token.
    const existing = body.installId
      ? (
          await db
            .select()
            .from(devices)
            .where(
              and(eq(devices.accountId, record.accountId), eq(devices.installId, body.installId)),
            )
            .limit(1)
        )[0]
      : undefined;

    let device;
    if (existing) {
      await revokeDeviceToken(existing.id);
      [device] = await db
        .update(devices)
        .set({
          role: "child",
          deviceInfo: body.deviceInfo ?? {},
          pairedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(devices.id, existing.id))
        .returning();
    } else {
      [device] = await db
        .insert(devices)
        .values({
          accountId: record.accountId,
          role: "child",
          installId: body.installId ?? null,
          deviceInfo: body.deviceInfo ?? {},
          pairedAt: new Date(),
        })
        .returning();
    }
    if (!device) return res.status(500).json({ ok: false, error: "Could not link device." });

    await markClaimed(token, record, device.id);
    const deviceToken = await createDeviceToken(device.id, record.accountId);

    const [account] = await db
      .select({ email: accounts.email })
      .from(accounts)
      .where(eq(accounts.id, record.accountId))
      .limit(1);

    return res.json({
      ok: true,
      deviceToken,
      deviceId: device.id,
      account: { email: account?.email ?? null },
    });
  }),
);

// GET /pairing/status?token=... — parent polls until the child claims.
pairingRouter.get(
  "/status",
  requireParent,
  ah(async (req, res) => {
    const token = String(req.query.token ?? "");
    const record = await getPairing(token);
    if (!record || record.accountId !== req.accountId) {
      // Unknown/expired (or not this parent's) — report unclaimed, not an error.
      return res.json({ ok: true, claimed: false, expired: !record });
    }
    return res.json({ ok: true, claimed: record.claimed, deviceId: record.deviceId ?? null });
  }),
);
