import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { db } from "../db/client";
import { accounts, devices } from "../db/schema";
import { createDeviceToken, revokeDeviceToken } from "../lib/device-token";
import { consumeConfirmToken, createConfirmToken } from "../lib/email-confirm";
import { ah, allowRequest, clientIp, publicBaseUrl } from "../lib/http";
import { logger } from "../lib/logger";
import { emailService } from "../services/email";

export const registerRouter = Router();

const normalizeEmail = (email: string) => email.toLowerCase().trim();

// Self-service pairing: the child device onboards the parent by email + WhatsApp,
// with NO parent app. Creates a passwordless account (if new), links this device,
// returns a device token, and emails the parent a confirmation link. Alerts only
// start once they confirm (also blocks spamming a stranger's inbox).
const RegisterBody = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  // E.164-ish, optional. Stored for future WhatsApp alerts (email is the v1 channel).
  whatsapp: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid phone number")
    .max(20)
    .optional(),
  deviceInfo: z
    .object({
      model: z.string().max(120).optional(),
      manufacturer: z.string().max(120).optional(),
      os: z.string().max(120).optional(),
    })
    .optional(),
  installId: z.string().min(8).max(200).optional(),
  deviceName: z.string().trim().max(120).optional(),
});

function defaultDeviceName(info: { model?: string; manufacturer?: string } | undefined, n: number): string {
  const make = (info?.manufacturer ?? "").trim();
  const model = (info?.model ?? "").trim();
  if (model) {
    const brand = make && !model.toLowerCase().startsWith(make.toLowerCase()) ? `${make[0]!.toUpperCase()}${make.slice(1).toLowerCase()} ` : "";
    return `${brand}${model}`.slice(0, 120);
  }
  return `Phone ${n}`;
}

registerRouter.post(
  "/",
  ah(async (req, res) => {
    // Abuse guard: cap registration spray per IP.
    if (!(await allowRequest(`register:${clientIp(req)}`, 20, 3600))) {
      return res.status(429).json({ ok: false, error: "Too many attempts. Try again later." });
    }

    const body = RegisterBody.parse(req.body);
    const email = normalizeEmail(body.email);

    // Find-or-create the (passwordless) parent account.
    let [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    if (!account) {
      [account] = await db
        .insert(accounts)
        .values({ email, whatsappNumber: body.whatsapp ?? null })
        .returning();
    } else if (body.whatsapp && body.whatsapp !== account.whatsappNumber) {
      [account] = await db
        .update(accounts)
        .set({ whatsappNumber: body.whatsapp, updatedAt: new Date() })
        .where(eq(accounts.id, account.id))
        .returning();
    }
    if (!account) return res.status(500).json({ ok: false, error: "Could not create account." });

    // Create-or-update this child device (dedupe on installId within the account).
    const existing = body.installId
      ? (
          await db
            .select()
            .from(devices)
            .where(and(eq(devices.accountId, account.id), eq(devices.installId, body.installId)))
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
          name: body.deviceName ?? existing.name ?? defaultDeviceName(body.deviceInfo, 1),
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
          accountId: account.id,
          role: "child",
          installId: body.installId ?? null,
          name: body.deviceName ?? defaultDeviceName(body.deviceInfo, (await db.select({ id: devices.id }).from(devices).where(eq(devices.accountId, account.id))).length + 1),
          deviceInfo: body.deviceInfo ?? {},
          pairedAt: new Date(),
        })
        .returning();
    }
    if (!device) return res.status(500).json({ ok: false, error: "Could not link device." });

    const deviceToken = await createDeviceToken(device.id, account.id);

    // Email the parent a confirmation link (unless already verified). We AWAIT it
    // and report whether it actually sent, so the child app can tell the parent
    // the truth instead of claiming success when Resend rejected the recipient
    // (e.g. an unverified sending domain). Device linking still succeeds either way.
    const needsConfirmation = !account.emailVerified;
    let emailSent = !needsConfirmation;
    if (needsConfirmation) {
      try {
        const token = await createConfirmToken(account.id);
        const url = `${publicBaseUrl(req)}/register/confirm?token=${token}`;
        await emailService.sendSetupConfirmation(email, url);
        emailSent = true;
        logger.info(`[register] confirmation email sent to ${email}`);
      } catch (e) {
        logger.error(`[register] confirmation email to ${email} failed`, e);
      }
    }

    return res.json({
      ok: true,
      deviceToken,
      deviceId: device.id,
      needsConfirmation,
      emailSent,
      account: { email: account.email },
    });
  }),
);

// GET /register/confirm?token=... — parent taps the emailed link to verify.
const page = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>body{font-family:system-ui,Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#1A1A1A;text-align:center}
  .card{border:1px solid #E5E7EB;border-radius:16px;padding:32px}h1{color:#1CABE2;font-size:22px}p{color:#4B5563;line-height:1.5}</style>
  </head><body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;

registerRouter.get(
  "/confirm",
  ah(async (req, res) => {
    const token = String(req.query.token ?? "");
    const accountId = token ? await consumeConfirmToken(token) : null;
    if (!accountId) {
      return res
        .status(400)
        .type("html")
        .send(page("Link expired", "This confirmation link is invalid or has expired. Re-open Lighthouse on the child's device to send a new one."));
    }
    await db
      .update(accounts)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(accounts.id, accountId));
    return res
      .type("html")
      .send(page("Email confirmed", "You're all set. You'll now get a weekly summary and urgent alerts for your child's device."));
  }),
);
