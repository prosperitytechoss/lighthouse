import { eq } from "drizzle-orm";
import { type NextFunction, type Request, type Response, Router } from "express";
import { z } from "zod";

import { db } from "../db/client";
import { accounts } from "../db/schema";
import { generateOtp, storeOtp, takeResendSlot, verifyOtp } from "../lib/otp";
import { hashPassword, verifyPassword } from "../lib/password";
import { createSession, destroyAllSessions, destroySession } from "../lib/session";
import { emailService } from "../services/email";

export const authRouter = Router();

// Wrap async handlers so thrown/rejected errors reach the centralized handler.
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
const ah = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res, next).catch(next);

const normalizeEmail = (email: string) => email.toLowerCase().trim();

// Shared, tightened field schemas (normalize + bound everything).
const emailField = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const newPasswordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");
const loginPasswordField = z.string().min(1, "Password is required").max(128);
const codeField = z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits");

// Generic, enumeration-safe responses.
const GENERIC_SIGNUP = "If that email can be registered, we've sent a 6-digit verification code.";
const GENERIC_RESEND = "If that email still needs verifying, we've sent a new code.";
const GENERIC_RESET = "If an account exists for that email, we've sent a password reset code.";
const BAD_CREDENTIALS = "Invalid email or password.";
const BAD_CODE = "That code is invalid or has expired.";

async function issueOtp(email: string): Promise<void> {
  const code = generateOtp();
  await storeOtp(email, code, "signup");
  await emailService.sendOtp(email, code);
}

async function issueResetCode(email: string): Promise<void> {
  const code = generateOtp();
  await storeOtp(email, code, "reset");
  await emailService.sendPasswordResetCode(email, code);
}

// POST /auth/signup — create an unverified account and send an OTP.
const SignupBody = z.object({ email: emailField, password: newPasswordField });
authRouter.post(
  "/signup",
  ah(async (req, res) => {
    const { email, password } = SignupBody.parse(req.body);
    const e = normalizeEmail(email);

    const existing = await db.select().from(accounts).where(eq(accounts.email, e)).limit(1);
    if (existing.length === 0) {
      const passwordHash = await hashPassword(password);
      await db.insert(accounts).values({ email: e, passwordHash });
      await issueOtp(e);
    } else if (!existing[0]!.emailVerified) {
      // Account exists but never verified — resend a fresh code.
      await issueOtp(e);
    }
    // Verified accounts: respond identically, send nothing (no enumeration).
    res.json({ ok: true, message: GENERIC_SIGNUP });
  }),
);

// POST /auth/verify-otp — verify, mark verified, issue a session.
const VerifyBody = z.object({
  email: emailField,
  code: codeField,
});
authRouter.post(
  "/verify-otp",
  ah(async (req, res) => {
    const { email, code } = VerifyBody.parse(req.body);
    const e = normalizeEmail(email);

    const result = await verifyOtp(e, code);
    if (result !== "ok") {
      const error = result === "too_many_attempts" ? "Too many attempts. Request a new code." : BAD_CODE;
      return res.status(400).json({ ok: false, error });
    }

    const [account] = await db
      .update(accounts)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(accounts.email, e))
      .returning();
    if (!account) return res.status(400).json({ ok: false, error: BAD_CODE });

    const token = await createSession(account.id);
    return res.json({ ok: true, token });
  }),
);

// POST /auth/login — verified accounts get a session.
const LoginBody = z.object({
  email: emailField,
  password: loginPasswordField,
});
authRouter.post(
  "/login",
  ah(async (req, res) => {
    const { email, password } = LoginBody.parse(req.body);
    const e = normalizeEmail(email);

    const [account] = await db.select().from(accounts).where(eq(accounts.email, e)).limit(1);
    // Passwordless accounts (onboarded from the child device) have no hash and
    // cannot log in with a password — respond with the same generic error.
    const ok = !!account && !!account.passwordHash && (await verifyPassword(account.passwordHash, password));
    if (!ok || !account) return res.status(401).json({ ok: false, error: BAD_CREDENTIALS });

    if (!account.emailVerified) {
      return res.status(403).json({ ok: false, error: "Please verify your email first.", needsVerification: true });
    }

    const token = await createSession(account.id);
    return res.json({ ok: true, token });
  }),
);

// POST /auth/resend-otp — rate-limited resend.
const ResendBody = z.object({ email: emailField });
authRouter.post(
  "/resend-otp",
  ah(async (req, res) => {
    const { email } = ResendBody.parse(req.body);
    const e = normalizeEmail(email);

    if (!(await takeResendSlot(e))) {
      return res.status(429).json({ ok: false, error: "Please wait a minute before requesting another code." });
    }
    const [account] = await db.select().from(accounts).where(eq(accounts.email, e)).limit(1);
    if (account && !account.emailVerified) await issueOtp(e);
    return res.json({ ok: true, message: GENERIC_RESEND });
  }),
);

// POST /auth/forgot-password — email a reset code (rate-limited, no enumeration).
const ForgotBody = z.object({ email: emailField });
authRouter.post(
  "/forgot-password",
  ah(async (req, res) => {
    const { email } = ForgotBody.parse(req.body);
    const e = normalizeEmail(email);

    if (!(await takeResendSlot(e, "reset"))) {
      return res.status(429).json({ ok: false, error: "Please wait a minute before requesting another code." });
    }
    const [account] = await db.select().from(accounts).where(eq(accounts.email, e)).limit(1);
    if (account) await issueResetCode(e); // only send if it exists; respond generically either way
    return res.json({ ok: true, message: GENERIC_RESET });
  }),
);

// POST /auth/reset-password — verify code, set new password, revoke all sessions.
const ResetBody = z.object({
  email: emailField,
  code: codeField,
  newPassword: newPasswordField,
});
authRouter.post(
  "/reset-password",
  ah(async (req, res) => {
    const { email, code, newPassword } = ResetBody.parse(req.body);
    const e = normalizeEmail(email);

    const result = await verifyOtp(e, code, "reset");
    if (result !== "ok") {
      const error = result === "too_many_attempts" ? "Too many attempts. Request a new code." : BAD_CODE;
      return res.status(400).json({ ok: false, error });
    }

    const passwordHash = await hashPassword(newPassword);
    const [account] = await db
      .update(accounts)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(accounts.email, e))
      .returning();
    if (!account) return res.status(400).json({ ok: false, error: BAD_CODE });

    await destroyAllSessions(account.id); // force re-login everywhere
    return res.json({ ok: true });
  }),
);

// POST /auth/logout — invalidate the session.
authRouter.post(
  "/logout",
  ah(async (req, res) => {
    const header = req.header("authorization") ?? "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : undefined;
    const token = bearer ?? (typeof req.body?.token === "string" ? req.body.token : undefined);
    if (token) await destroySession(token);
    res.json({ ok: true });
  }),
);
