import { MONITORED_APPS } from "@lighthouse/types";
import { and, eq, gte } from "drizzle-orm";

import { env } from "../config/env";
import { db } from "../db/client";
import { accounts, devices, signals } from "../db/schema";
import { groupEpisodes, type RawSignal } from "../lib/episodes";
import { logger } from "../lib/logger";
import { decryptSignalContent } from "../lib/signal-crypto";

import { emailService, type WeeklySummary } from "./email";

/**
 * The weekly parent summary (PRD: "Lighthouse Weekly Update").
 *
 * One short, calm email per child per week. Priorities, in order: reassure
 * (most weeks are calm), give a simple honest picture, nudge one conversation.
 * Everything here is derived from the same tagged metadata the parent screens
 * use (app + category + severity) — never content, and no numbers we don't
 * truly have: screen-time totals aren't collected, so the "at a glance" block
 * reports quiet days and where things came up instead of invented hours.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
/** Once-per-week dedup gap. Less than 7d so a slightly-early Sunday still sends. */
const MIN_GAP_MS = 6 * DAY_MS;

/**
 * Fixed tip library (PRD §8) — one per weekly, rotating in order and looping.
 * Fixed is deliberate: easy to keep on-brand, and it cannot appear to read the
 * child's mind. The rotation is keyed to the calendar week, so every parent
 * gets the same tip in a given week and no parent repeats inside 15 weeks.
 */
export const WEEKLY_TIPS: readonly string[] = [
  "Kids copy what they see. Charging your own phone outside the bedroom at night makes it easier to ask the same of them.",
  "You don't have to react in the moment. Reading this on a quiet day gives you time to raise something gently, not in the heat of it.",
  'A calm question like "what are you watching these days?" opens more than "give me your phone" ever will.',
  "Agreeing on phone rules together, out loud, works better than rules a child discovers by breaking them.",
  "Watching one video together now and then teaches you more about your child's world than any report can.",
  "A short daily check-in beats a long monthly argument. Small and often wins.",
  "Curiosity travels further than control. Ask before you assume.",
  "One shared meal a day with phones away is a small habit with a big return.",
  "If screen time climbs, look at what changed in the week before you look at the phone. Boredom, stress, and school breaks all show up as more scrolling.",
  "Praise the good choices you notice. Children repeat what gets noticed.",
  "Your own phone habits are the loudest lesson in the house. Nobody's are perfect, and children respect the effort.",
  "A phone is easier to hand over at night if there's somewhere else to charge it. Set up the spot before the rule.",
  'Late nights online are often about sleep, not the phone. "How are you sleeping?" is a good place to start.',
  "You know your child better than any app does. Use what you see here to start the conversation, not to end it.",
  "Progress, not perfection. A slightly calmer week is a real win.",
];

export function tipForWeek(now = new Date()): string {
  return WEEKLY_TIPS[Math.floor(now.getTime() / WEEK_MS) % WEEKLY_TIPS.length]!;
}

const APP_LABEL = new Map<string, string>(MONITORED_APPS.map((a) => [a.id, a.displayName]));

/** Local calendar day key (YYYY-MM-DD) in the digest timezone. */
function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: env.WEEKLY_DIGEST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function weekdayName(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: env.WEEKLY_DIGEST_TZ, weekday: "long" }).format(d);
}

/**
 * Build one child's weekly summary from their decrypted signals.
 *
 * - "Flagged moments" = episodes at/above `review` (what the product itself
 *   considers worth surfacing; `low` stays background noise).
 * - Conversation items are calmer restatements of this week's high-severity
 *   episodes — things the parent already saw as live alerts (PRD §6). Capped
 *   at two: more than two is a real-time-alert situation, not a weekly one.
 * - Trend compares flagged moments against the child's OWN previous week and
 *   is null when there is no full previous week to compare against (new
 *   install — the template drops the clause rather than inventing a baseline).
 */
export function buildWeeklySummary(args: {
  childName: string;
  pairedAt: Date | null;
  thisWeek: RawSignal[];
  prevWeek: RawSignal[];
  now?: Date;
}): WeeklySummary {
  const now = args.now ?? new Date();
  const episodes = groupEpisodes(args.thisWeek);
  const flagged = episodes.filter((e) => e.topSeverity === "high" || e.topSeverity === "review");
  const high = episodes.filter((e) => e.topSeverity === "high");

  // Days this weekly can honestly speak for: capped at 7, floored at 1, and
  // shortened for a mid-week install so we never claim days we weren't there.
  const sincePaired = args.pairedAt ? Math.ceil((now.getTime() - args.pairedAt.getTime()) / DAY_MS) : 7;
  const daysCovered = Math.max(1, Math.min(7, sincePaired));

  const flaggedDayKeys = new Set(flagged.map((e) => dayKey(new Date(e.endAt))));
  const quietDays = Math.max(0, daysCovered - flaggedDayKeys.size);

  const appsSeen = Array.from(new Set(flagged.map((e) => APP_LABEL.get(e.app) ?? e.app)));

  // Trend needs a full previous week of coverage; otherwise omit (PRD §14).
  const hasBaseline = !args.pairedAt || now.getTime() - args.pairedAt.getTime() >= 2 * WEEK_MS;
  let trend: WeeklySummary["trend"] = null;
  if (hasBaseline) {
    const prevFlagged = groupEpisodes(args.prevWeek).filter(
      (e) => e.topSeverity === "high" || e.topSeverity === "review",
    ).length;
    const diff = flagged.length - prevFlagged;
    // "Same" absorbs small wobble so the weekly doesn't dramatize one episode.
    if (Math.abs(diff) <= Math.max(1, Math.round(prevFlagged * 0.2))) trend = "same";
    else trend = diff < 0 ? "down" : "up";
  }

  // Newest high episodes first — the ones the parent most likely remembers.
  const conversationItems = high.slice(0, 2).map((e) => {
    const app = APP_LABEL.get(e.app) ?? e.app;
    const day = weekdayName(new Date(e.endAt));
    return `Something around ${e.category.toLowerCase()} came up in ${app} on ${day}. You may have seen the alert at the time.`;
  });

  return {
    childName: args.childName,
    weekStatus: high.length > 0 ? "attention" : "calm",
    daysCovered,
    quietDays,
    appsSeen,
    trend,
    conversationItems,
    tip: tipForWeek(now),
  };
}

/**
 * Send this week's summaries: one email per child device, for every account
 * with a verified email and the weekly switched on. Dedup is the per-DEVICE
 * `weeklyDigestSentAt` stamp (min 6-day gap), so the Sunday scheduler can poll
 * all morning without double-sending and a failed sibling only retries itself.
 * Devices that aren't reporting are skipped: no data means no summary, not a
 * fake calm one. `force` ignores the stamp (admin/test).
 */
export async function runWeeklyDigests(opts?: { force?: boolean }): Promise<{ sent: number }> {
  const now = new Date();
  const eligible = await db
    .select({ id: accounts.id, email: accounts.email })
    .from(accounts)
    .where(and(eq(accounts.emailVerified, true), eq(accounts.weeklyDigestEnabled, true)));

  let sent = 0;
  for (const acct of eligible) {
    const allChildren = await db
      .select({
        id: devices.id,
        name: devices.name,
        assignee: devices.assignee,
        pairedAt: devices.pairedAt,
        createdAt: devices.createdAt,
        lastSeenAt: devices.lastSeenAt,
        weeklyDigestSentAt: devices.weeklyDigestSentAt,
      })
      .from(devices)
      .where(and(eq(devices.accountId, acct.id), eq(devices.role, "child")));

    // A phone that isn't reporting gets no weekly: "7 quiet days" would be a
    // lie when the app is off or uninstalled. The silence alert already told
    // the parent. Also dedup per device so a retry never resends a sibling.
    const silenceMs = env.SILENCE_HOURS * 60 * 60 * 1000;
    const children = allChildren.filter((c) => {
      const last = (c.lastSeenAt ?? c.pairedAt ?? c.createdAt).getTime();
      if (now.getTime() - last > silenceMs) {
        logger.info(`[digest] skip ${c.id}: not reporting since ${new Date(last).toISOString()}`);
        return false;
      }
      if (!opts?.force && c.weeklyDigestSentAt && now.getTime() - c.weeklyDigestSentAt.getTime() < MIN_GAP_MS) {
        return false;
      }
      return true;
    });
    if (children.length === 0) continue;

    // One 14-day fetch per account (this week + baseline week), split per device.
    const since = new Date(now.getTime() - 2 * WEEK_MS);
    const rows = await db
      .select()
      .from(signals)
      .where(and(eq(signals.accountId, acct.id), gte(signals.occurredAt, since)));
    const weekAgo = now.getTime() - WEEK_MS;
    const byDevice = new Map<string, { thisWeek: RawSignal[]; prevWeek: RawSignal[] }>();
    for (const r of rows) {
      const c = decryptSignalContent(r.payload);
      const raw: RawSignal = {
        id: r.id,
        deviceId: r.deviceId,
        category: c.category,
        severity: c.severity,
        app: c.app,
        occurredAt: r.occurredAt,
      };
      let bucket = byDevice.get(r.deviceId);
      if (!bucket) byDevice.set(r.deviceId, (bucket = { thisWeek: [], prevWeek: [] }));
      (r.occurredAt.getTime() >= weekAgo ? bucket.thisWeek : bucket.prevWeek).push(raw);
    }

    for (const child of children) {
      try {
        const summary = buildWeeklySummary({
          childName: child.assignee ?? child.name ?? "your child",
          pairedAt: child.pairedAt,
          thisWeek: byDevice.get(child.id)?.thisWeek ?? [],
          prevWeek: byDevice.get(child.id)?.prevWeek ?? [],
          now,
        });
        await emailService.sendWeeklyDigest(acct.email, summary);
        // Stamp THIS device only, right after its send, so a later failure
        // for a sibling can't cause this one to go out twice on retry.
        await db.update(devices).set({ weeklyDigestSentAt: now }).where(eq(devices.id, child.id));
        sent += 1;
      } catch (e) {
        // No stamp on failure — the next poll retries just this device.
        logger.error(`[digest] send failed for device ${child.id} (account ${acct.id})`, e);
      }
    }
    await db.update(accounts).set({ weeklyDigestSentAt: now }).where(eq(accounts.id, acct.id));
  }
  logger.info(`[digest] weekly run: ${sent} email(s) sent`);
  return { sent };
}
