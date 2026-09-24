import { Resend } from "resend";

import { env, isProd } from "../config/env";
import { logger } from "../lib/logger";

/**
 * Email behind an interface with two transports:
 *  - Resend (real) when RESEND_API_KEY is set.
 *  - Dev (logs the OTP to the console) otherwise, so the flow runs without a key.
 */
/**
 * The weekly parent summary (PRD "Lighthouse Weekly Update"). Warm, calm, and
 * honest: quiet days + where things came up (no invented screen-time numbers),
 * 0–2 conversation nudges, one tip. Never alarming — alarms are the urgent
 * alert's job, in real time.
 */
export type WeeklySummary = {
  childName: string;
  /** calm = nothing high-severity this week (the default, most weeks). */
  weekStatus: "calm" | "attention";
  /** Days this summary can speak for (7, or fewer right after install). */
  daysCovered: number;
  quietDays: number;
  /** Display names of apps where flagged moments happened (may be empty). */
  appsSeen: string[];
  /** Vs the child's own previous week; null = no baseline yet (new install). */
  trend: "down" | "up" | "same" | null;
  /** 0–2 calmer restatements of alerts the parent already saw live. */
  conversationItems: string[];
  tip: string;
};

/** In-app feedback from the child device, relayed to the admin inbox. */
export type AppFeedback = {
  type: "bug" | "wrong_flag" | "idea";
  message: string;
  deviceId: string;
  /** From the x-app-version header, when the app sent one. */
  appVersion: string | null;
};

export type UrgentAlert = {
  apps: string[];
  categories: string[];
  deviceName: string;
  /** Whether the child device actually paused the screen (overlay on). */
  blocked: boolean;
};

export interface EmailService {
  sendOtp(to: string, code: string): Promise<void>;
  sendPasswordResetCode(to: string, code: string): Promise<void>;
  sendWeeklyDigest(to: string, summary: WeeklySummary): Promise<void>;
  sendMagicLink(to: string, url: string): Promise<void>;
  /** Setup: confirm the parent's email after child-device onboarding. */
  sendSetupConfirmation(to: string, url: string): Promise<void>;
  /** Urgent: a high-severity signal fired on the child device. */
  sendUrgentAlert(to: string, alert: UrgentAlert): Promise<void>;
  /** Safety net: the child device went silent (may be off/disabled). */
  sendSilenceAlert(to: string, deviceName: string): Promise<void>;
  /** Tamper: monitoring was disabled on the child device while it's still alive. */
  sendTamperAlert(to: string, deviceName: string): Promise<void>;
  /** Safety gate: code required to turn off email alerts from the child device. */
  sendSettingsOtp(to: string, code: string): Promise<void>;
  /** In-app feedback relayed to the admin inbox. */
  sendFeedback(to: string, feedback: AppFeedback): Promise<void>;
}

/**
 * Shared branded shell — every Lighthouse email uses this card so nothing goes
 * out as bare plain text: colored header bar, white body, hairline border.
 */
function shellHtml(header: string, headerColor: string, innerHtml: string): string {
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1A1A1A">
    <div style="background:${headerColor};color:#fff;padding:16px;border-radius:12px 12px 0 0;font-weight:700">${header}</div>
    <div style="border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:16px">${innerHtml}</div>
  </div>`;
}

const BRAND_CYAN = "#1CABE2";
const WARN_AMBER = "#D97706";

const codeHtml = (lead: string, code: string, foot: string) =>
  shellHtml("Lighthouse", BRAND_CYAN, `<p style="margin:0 0 12px">${lead}</p>
    <p style="font-family:ui-monospace,Menlo,monospace;font-size:28px;letter-spacing:6px;font-weight:600;margin:0 0 12px">${code}</p>
    <p style="color:#8E8E93;font-size:12px;margin:0">${foot}</p>`);

const MAGIC_SUBJECT = "Sign in to Lighthouse Lexicon Admin";
const magicText = (url: string) =>
  `Click to sign in to Lighthouse Lexicon Admin:\n${url}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this email.`;

const OTP_SUBJECT = "Your Lighthouse verification code";
const RESET_SUBJECT = "Your Lighthouse password reset code";
const CONFIRM_SUBJECT = "Confirm your email to start getting Lighthouse alerts";
const ALERT_SUBJECT = "Lighthouse alert";
const SILENCE_SUBJECT = "Lighthouse may be off on your child's device";
const TAMPER_SUBJECT = "Lighthouse monitoring was turned off";
const SETTINGS_OTP_SUBJECT = "Your Lighthouse confirmation code";

// The OTP gate copy: turning alerts off is the one child-side action a parent
// must confirm by email, so a kid can't quietly silence the channel.
const SETTINGS_OTP_LEAD =
  "Someone asked to turn off Lighthouse email alerts on your child's device. Enter this code on the device to confirm it was you:";
const SETTINGS_OTP_FOOT =
  "Expires in 10 minutes. If you didn't ask for this, ignore this email and alerts stay on.";
const settingsOtpText = (code: string) =>
  `${SETTINGS_OTP_LEAD} ${code}. ${SETTINGS_OTP_FOOT}`;

const feedbackSubject = (f: AppFeedback) => `Lighthouse app feedback (${f.type})`;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const feedbackText = (f: AppFeedback) =>
  [
    `Type: ${f.type}`,
    `Device: ${f.deviceId}`,
    `App version: ${f.appVersion ?? "not sent"}`,
    "",
    f.message,
  ].join("\n");

const feedbackHtml = (f: AppFeedback) =>
  shellHtml("Lighthouse app feedback", BRAND_CYAN,
    `<p style="margin:0 0 4px;font-size:13px;color:#8E8E93">Type: <b style="color:#1A1A1A">${f.type}</b></p>
    <p style="margin:0 0 4px;font-size:13px;color:#8E8E93">Device: <b style="color:#1A1A1A">${f.deviceId}</b></p>
    <p style="margin:0 0 12px;font-size:13px;color:#8E8E93">App version: <b style="color:#1A1A1A">${escapeHtml(f.appVersion ?? "not sent")}</b></p>
    <p style="margin:0;white-space:pre-wrap">${escapeHtml(f.message)}</p>`);

const confirmText = (url: string) =>
  [
    "Your child's device is now set up with Lighthouse.",
    "",
    "Confirm this email address to start receiving weekly summaries and urgent safety alerts:",
    url,
    "",
    "If you didn't set this up, you can ignore this email — no alerts will be sent until you confirm.",
  ].join("\n");

const confirmHtml = (url: string) =>
  `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1A1A1A">
    <div style="background:#1CABE2;color:#fff;padding:16px;border-radius:12px 12px 0 0;font-weight:700">Lighthouse</div>
    <div style="border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:16px">
      <p>Your child's device is now set up with Lighthouse.</p>
      <p>Confirm your email to start receiving weekly summaries and urgent safety alerts:</p>
      <p style="margin:20px 0"><a href="${url}" style="background:#1CABE2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Confirm email</a></p>
      <p style="color:#8E8E93;font-size:12px">If you didn't set this up, ignore this email — no alerts are sent until you confirm.</p>
    </div>
  </div>`;

const urgentLine = (a: UrgentAlert) => {
  const cats = a.categories.join(", ");
  const apps = a.apps.length ? ` in ${a.apps.join(", ")}` : "";
  return a.blocked
    ? `Lighthouse paused the screen on ${a.deviceName}${apps} — ${cats} was detected.`
    : `${cats} was detected${apps} on ${a.deviceName}.`;
};

const urgentText = (a: UrgentAlert) =>
  [
    urgentLine(a),
    "",
    "Lighthouse flags what happened and how serious it is — never the actual content. It was processed on the device.",
  ].join("\n");

const urgentHtml = (a: UrgentAlert) => {
  const cats = a.categories.join(", ");
  const apps = a.apps.length ? ` in <b>${a.apps.join(", ")}</b>` : "";
  const line = a.blocked
    ? `Lighthouse <b>paused the screen</b> on <b>${a.deviceName}</b>${apps} — <b>${cats}</b> was detected.`
    : `<b>${cats}</b> was detected${apps} on <b>${a.deviceName}</b>.`;
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1A1A1A">
    <div style="background:#E5484D;color:#fff;padding:16px;border-radius:12px 12px 0 0;font-weight:700">Lighthouse alert</div>
    <div style="border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:16px">
      <p style="font-size:16px">${line}</p>
      <p style="color:#8E8E93;font-size:12px;margin-top:16px">Lighthouse flags what happened and how serious it is — never the actual content. Processed on the device.</p>
    </div>
  </div>`;
};

// ── Weekly summary (PRD structure: status → glance → conversation → tip → sign-off) ──

// childName may be the fallback "your child" — capitalize where it leads a line.
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const weeklySubject = (s: WeeklySummary) =>
  s.weekStatus === "calm"
    ? `${cap(s.childName)}'s week — all calm`
    : s.conversationItems.length > 1
      ? `${cap(s.childName)}'s week — a couple of things worth a chat`
      : `${cap(s.childName)}'s week — one thing worth a chat`;

const weeklyStatusSentence = (s: WeeklySummary) =>
  s.weekStatus === "calm"
    ? "This week was calm. Nothing needed your attention."
    : s.conversationItems.length > 1
      ? "Mostly a calm week, with a couple of things you might want to talk about."
      : "Mostly a calm week, with one thing you might want to talk about.";

const TREND_PHRASE: Record<"down" | "up" | "same", string> = {
  down: "a little calmer than last week",
  up: "a little busier than last week",
  same: "about the same as last week",
};

/** The "week at a glance" lines — only numbers we honestly have. */
function weeklyGlanceLines(s: WeeklySummary): string[] {
  const quiet =
    s.daysCovered < 7
      ? `Quiet days: ${s.quietDays} of the ${s.daysCovered} since Lighthouse started`
      : `Quiet days: ${s.quietDays} of 7`;
  const lines = [quiet];
  if (s.appsSeen.length > 0) lines.push(`Where things came up: ${s.appsSeen.join(", ")}`);
  if (s.trend) lines.push(`Overall: ${TREND_PHRASE[s.trend]}`);
  return lines;
}

function weeklyConversationLines(s: WeeklySummary): string[] {
  if (s.conversationItems.length === 0) return ["Nothing came up this week."];
  return [
    ...s.conversationItems,
    "It might be nothing. A calm question usually opens more than a confrontation.",
  ];
}

const WEEKLY_SIGNOFF =
  "You're in control of all of this. Reply to this email anytime you need us.";

const WEEKLY_PRIVACY_LINE =
  "Everything above comes from checks done on the phone itself. What was on screen was never saved or sent — Lighthouse only reports the kind of thing that came up, never the words or pictures.";

function digestText(s: WeeklySummary): string {
  return [
    "Hi,",
    "",
    weeklyStatusSentence(s),
    "",
    "The week at a glance",
    ...weeklyGlanceLines(s).map((l) => `- ${l}`),
    "",
    "Worth a conversation",
    ...weeklyConversationLines(s),
    "",
    "This week's tip",
    s.tip,
    "",
    WEEKLY_SIGNOFF,
    "",
    WEEKLY_PRIVACY_LINE,
    "",
    "— The Lighthouse team",
  ].join("\n");
}

function digestHtml(s: WeeklySummary): string {
  const glance = weeklyGlanceLines(s)
    .map((l) => `<li style="margin:4px 0">${l}</li>`)
    .join("");
  const conversation = weeklyConversationLines(s)
    .map((l) => `<p style="margin:4px 0">${l}</p>`)
    .join("");
  const h4 = 'style="margin:20px 0 6px;font-size:13px;letter-spacing:0.4px;text-transform:uppercase;color:#8E8E93"';
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1A1A1A">
    <div style="background:#1CABE2;color:#fff;padding:16px;border-radius:12px 12px 0 0;font-weight:700">${cap(s.childName)}'s week</div>
    <div style="border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:16px">
      <p style="font-size:17px;margin:0">${weeklyStatusSentence(s)}</p>
      <h4 ${h4}>The week at a glance</h4>
      <ul style="margin:0;padding-left:18px;font-size:14px">${glance}</ul>
      <h4 ${h4}>Worth a conversation</h4>
      <div style="font-size:14px">${conversation}</div>
      <h4 ${h4}>This week's tip</h4>
      <p style="margin:4px 0;font-size:14px">${s.tip}</p>
      <p style="margin-top:20px;font-size:13px;color:#4A4A4A">${WEEKLY_SIGNOFF}</p>
      <p style="color:#8E8E93;font-size:12px;margin-top:16px">${WEEKLY_PRIVACY_LINE}</p>
    </div>
  </div>`;
}

function otpText(code: string): string {
  return `Your Lighthouse verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`;
}

function resetText(code: string): string {
  return `Your Lighthouse password reset code is ${code}. It expires in 10 minutes. If you didn't request a reset, you can safely ignore this email.`;
}

class DevEmailService implements EmailService {
  async sendOtp(to: string, code: string): Promise<void> {
    logger.info(`[email:dev] OTP for ${to} -> ${code} (expires in 10m)`);
  }
  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    logger.info(`[email:dev] RESET code for ${to} -> ${code} (expires in 10m)`);
  }
  async sendWeeklyDigest(to: string, summary: WeeklySummary): Promise<void> {
    logger.info(
      `[email:dev] WEEKLY SUMMARY for ${to} — "${weeklySubject(summary)}":\n${digestText(summary)}`,
    );
  }
  async sendMagicLink(to: string, url: string): Promise<void> {
    logger.info(`[email:dev] MAGIC LINK for ${to} -> ${url} (expires in 15m)`);
  }
  async sendSetupConfirmation(to: string, url: string): Promise<void> {
    logger.info(`[email:dev] SETUP CONFIRM for ${to} -> ${url}`);
  }
  async sendUrgentAlert(to: string, alert: UrgentAlert): Promise<void> {
    logger.info(`[email:dev] URGENT ALERT for ${to}:\n${urgentText(alert)}`);
  }
  async sendSilenceAlert(to: string, deviceName: string): Promise<void> {
    logger.info(`[email:dev] SILENCE ALERT for ${to} (${deviceName})`);
  }
  async sendTamperAlert(to: string, deviceName: string): Promise<void> {
    logger.info(`[email:dev] TAMPER ALERT for ${to} (${deviceName})`);
  }
  async sendSettingsOtp(to: string, code: string): Promise<void> {
    logger.info(`[email:dev] SETTINGS OTP for ${to} -> ${code} (expires in 10m)`);
  }
  async sendFeedback(to: string, feedback: AppFeedback): Promise<void> {
    logger.info(`[email:dev] FEEDBACK for ${to}:\n${feedbackText(feedback)}`);
  }
}

class ResendEmailService implements EmailService {
  private client: Resend;
  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }
  async sendOtp(to: string, code: string): Promise<void> {
    await this.send(to, OTP_SUBJECT, otpText(code),
      codeHtml("Your Lighthouse verification code:", code, "Expires in 10 minutes. Didn't request this? Ignore this email."));
  }
  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    await this.send(to, RESET_SUBJECT, resetText(code),
      codeHtml("Your Lighthouse password reset code:", code, "Expires in 10 minutes. Didn't request a reset? Ignore this email."));
  }
  async sendWeeklyDigest(to: string, summary: WeeklySummary): Promise<void> {
    await this.send(to, weeklySubject(summary), digestText(summary), digestHtml(summary));
  }
  async sendMagicLink(to: string, url: string): Promise<void> {
    await this.send(to, MAGIC_SUBJECT, magicText(url),
      shellHtml("Lighthouse Lexicon Admin", BRAND_CYAN,
        `<p style="margin:0 0 16px">Click to sign in:</p>
        <p style="margin:0 0 16px"><a href="${url}" style="background:${BRAND_CYAN};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Sign in</a></p>
        <p style="color:#8E8E93;font-size:12px;margin:0">This link expires in 15 minutes. If you didn't request it, ignore this email.</p>`));
  }
  async sendSetupConfirmation(to: string, url: string): Promise<void> {
    await this.send(to, CONFIRM_SUBJECT, confirmText(url), confirmHtml(url));
  }
  async sendUrgentAlert(to: string, alert: UrgentAlert): Promise<void> {
    await this.send(to, ALERT_SUBJECT, urgentText(alert), urgentHtml(alert));
  }
  async sendSilenceAlert(to: string, deviceName: string): Promise<void> {
    const text = `Lighthouse on ${deviceName} hasn't reported in a while — it may be off or disabled. If that's unexpected, check the device.`;
    await this.send(to, SILENCE_SUBJECT, text,
      shellHtml("Lighthouse", WARN_AMBER,
        `<p style="font-size:16px;margin:0">Lighthouse on <b>${deviceName}</b> hasn't reported in a while — it may be off or disabled.</p>
        <p style="color:#8E8E93;font-size:12px;margin:16px 0 0">If that's unexpected, check that the phone is on and Lighthouse is still installed.</p>`));
  }
  async sendTamperAlert(to: string, deviceName: string): Promise<void> {
    const text = `Monitoring on ${deviceName} was turned off while the device is still in use. If that's unexpected, check the device.`;
    await this.send(to, TAMPER_SUBJECT, text,
      shellHtml("Lighthouse", WARN_AMBER,
        `<p style="font-size:16px;margin:0">Monitoring on <b>${deviceName}</b> was turned off while the phone is still in use.</p>
        <p style="color:#8E8E93;font-size:12px;margin:16px 0 0">If that's unexpected, open Lighthouse on the phone and turn monitoring back on.</p>`));
  }
  async sendSettingsOtp(to: string, code: string): Promise<void> {
    await this.send(to, SETTINGS_OTP_SUBJECT, settingsOtpText(code),
      codeHtml(SETTINGS_OTP_LEAD, code, SETTINGS_OTP_FOOT));
  }
  async sendFeedback(to: string, feedback: AppFeedback): Promise<void> {
    await this.send(to, feedbackSubject(feedback), feedbackText(feedback), feedbackHtml(feedback));
  }
  /** Single logged path for every outgoing email — success and failure both land in the logs. */
  private async send(to: string, subject: string, text: string, html?: string): Promise<void> {
    const { data, error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    });
    if (error) {
      logger.error(`[email] FAILED "${subject}" -> ${to}: ${error.message}`);
      throw new Error(`Resend send failed: ${error.message}`);
    }
    logger.info(`[email] sent "${subject}" -> ${to} (id: ${data?.id ?? "?"})`);
  }
}

export const emailService: EmailService = env.RESEND_API_KEY
  ? new ResendEmailService(env.RESEND_API_KEY)
  : new DevEmailService();

// Say which transport is live, loudly — a child-safety product whose emails
// silently go nowhere is the worst kind of "working".
if (env.RESEND_API_KEY) {
  logger.info(`[email] Resend transport active (from: ${env.EMAIL_FROM})`);
} else if (isProd) {
  logger.error(
    "[email] RESEND_API_KEY is NOT set — running the log-only dev transport in production. NO emails (confirmation, alerts, weekly) are being delivered.",
  );
} else {
  logger.info("[email] dev transport (log-only) — set RESEND_API_KEY for real delivery");
}
