import { boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Placeholder liveness table (kept from the infra scaffold). Real domain tables
 * are below.
 */
export const healthChecks = pgTable("health_checks", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("ok"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A device's role in a household. */
export const deviceRole = pgEnum("device_role", ["parent", "child"]);

/**
 * A parent account. Auth is email/password + email OTP. The password is stored
 * only as an argon2id hash; OTPs live in Redis (hashed), never here.
 */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  // Nullable: parents onboarded from the child device (self-service registration)
  // are passwordless — they receive email notifications and never log in.
  passwordHash: text("password_hash"),
  // Parent's WhatsApp number (E.164), collected at child setup for future
  // WhatsApp alerts. Email is the v1 channel; this is stored ahead of that.
  whatsappNumber: text("whatsapp_number"),
  emailVerified: boolean("email_verified").notNull().default(false),
  // Parent-controlled toggle: push alerts for signals. (Legacy: the parent app
  // is deprecated; alerts now go by email — see emailAlertsEnabled.)
  pushEnabled: boolean("push_enabled").notNull().default(false),
  // Master switch for the email notification channel (urgent alerts, silence,
  // tamper). Weekly digest also respects it. Default on.
  emailAlertsEnabled: boolean("email_alerts_enabled").notNull().default(true),
  // Which severities trigger an alert: 'severe' = high only, 'moderate' = high+review,
  // 'all' = everything. Real, server-backed (Settings "Severity threshold").
  alertThreshold: text("alert_threshold").notNull().default("severe"),
  // Weekly summary email on/off. On for everyone by default; server-side only
  // (no app toggle — product call: the weekly goes to all parents). Kept as a
  // column so support can silence one account, independent of safety alerts.
  weeklyDigestEnabled: boolean("weekly_digest_enabled").notNull().default(true),
  // When this account's weekly run last completed. Informational only: the
  // real once-per-week dedup is per device (devices.weeklyDigestSentAt).
  weeklyDigestSentAt: timestamp("weekly_digest_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Expo push tokens registered by a parent's device(s). One account, many devices. */
export const pushTokens = pgTable("push_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A device linked to an account. Everything is account-scoped so signal access
 * control falls out naturally when signals land (Phase 5+).
 */
export type DeviceInfo = { model?: string; manufacturer?: string; os?: string };

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  role: deviceRole("role").notNull(),
  // Stable per-install id sent by the child. Lets re-pairing the same physical
  // device update its existing row instead of creating a duplicate.
  installId: text("install_id"),
  // Parent-set label + assigned person; captured native device details.
  name: text("name"),
  assignee: text("assignee"),
  deviceInfo: jsonb("device_info").$type<DeviceInfo>(),
  pairedAt: timestamp("paired_at", { withTimezone: true }),
  // Updated on any device-authed request (ingest + /devices/me heartbeat), so
  // the parent's "last seen" is a real value rather than a placeholder.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  // When we last alerted the parent that this device went silent — so we alert
  // once per silence episode, not every check. Cleared on the next heartbeat.
  silenceAlertedAt: timestamp("silence_alerted_at", { withTimezone: true }),
  // Capture-permission state, self-reported on each heartbeat. Lets us catch
  // "alive but monitoring disabled" (tamper) — distinct from silence (gone).
  accessibilityEnabled: boolean("accessibility_enabled"),
  notificationAccessEnabled: boolean("notification_access_enabled"),
  batteryOptimizationExempt: boolean("battery_optimization_exempt"),
  // Device battery health, last-reported on the heartbeat (current state, not a
  // time series). null = never reported. A dying phone = monitoring about to stop.
  batteryLevel: integer("battery_level"),
  batteryCharging: boolean("battery_charging"),
  // Dedup for the tamper alert (one per episode; cleared when re-enabled).
  tamperAlertedAt: timestamp("tamper_alerted_at", { withTimezone: true }),
  // When this device's weekly summary last went out. Per device (not per
  // account) so a failed send for one child can never resend another's.
  weeklyDigestSentAt: timestamp("weekly_digest_sent_at", { withTimezone: true }),
  // Per-app monitoring preference (parent-set, per device): which MONITORED_APPS
  // ids are captured on the child. null = all enabled (default / current behavior).
  monitoredApps: text("monitored_apps").array(),
  // Protective-overlay (real-time blocking) on/off, parent-set per device. Default
  // on: with the rule scoped to high+high-confidence, blocking is the intended
  // protection — the parent can switch to flag-only here.
  overlayEnabled: boolean("overlay_enabled").notNull().default(true),
  visionEnabled: boolean("vision_enabled").default(true),
  visionSupported: boolean("vision_supported"),
  visionTier: text("vision_tier"),
  visionIntervalMs: integer("vision_interval_ms"),
  visionFrames: integer("vision_frames"),
  visionLastFrameAt: timestamp("vision_last_frame_at", { withTimezone: true }),
  engineStats: jsonb("engine_stats"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Where a signal came from: a debug/synthetic emitter vs the real engine. */
export const signalSource = pgEnum("signal_source", ["synthetic", "real"]);

/**
 * A monitoring signal. Content (category/severity/app) is sensitive metadata, so
 * it is encrypted at the application layer (AES-256-GCM) into `payload` before it
 * ever touches the DB — a stolen dump leaks nothing readable. Only identifiers,
 * timestamps, and the source stay plaintext, for scoping/sorting/indexing.
 *
 * Because category/severity are encrypted, we do NOT SQL GROUP BY them; the
 * summary endpoint decrypts and aggregates in the app layer (volume is tiny).
 */
export const signals = pgTable(
  "signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // AES-256-GCM ciphertext of { category, severity, app }. Opaque at rest.
    payload: text("payload").notNull(),
    source: signalSource("source").notNull().default("synthetic"),
    channel: text("channel").notNull().default("text"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byAccount: index("signals_account_occurred_idx").on(t.accountId, t.occurredAt),
    byDevice: index("signals_device_occurred_idx").on(t.deviceId, t.occurredAt),
  }),
);

/**
 * A child location point. The coordinates are the most sensitive data we hold, so
 * { lat, lng, accuracy } is encrypted at the application layer (AES-256-GCM) into
 * `payload` before it touches the DB — a stolen dump leaks no readable position.
 * Only identifiers and timestamps stay plaintext, for scoping/sorting/indexing.
 *
 * `capturedAt` is the device-reported fix time; `createdAt` is server receipt.
 * There is no SQL on coordinates (they're opaque) — the parent read decrypts in
 * the app layer. Location part A captures + stores only; no parent map yet.
 */
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // AES-256-GCM ciphertext of { lat, lng, accuracy }. Opaque at rest.
    payload: text("payload").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byAccount: index("locations_account_captured_idx").on(t.accountId, t.capturedAt),
    byDevice: index("locations_device_captured_idx").on(t.deviceId, t.capturedAt),
  }),
);

/** In-app feedback from the child device (bug / wrong flag / idea). */
export const feedbackType = pgEnum("feedback_type", ["bug", "wrong_flag", "idea"]);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    type: feedbackType("type").notNull(),
    message: text("message").notNull(),
    appVersion: text("app_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCreated: index("feedback_created_idx").on(t.createdAt),
  }),
);

export type Feedback = typeof feedback.$inferSelect;

// ── Lexicon Admin ──────────────────────────────────────────────────────────
// The on-device rules classifier's word lists, DB-owned + versioned so admins
// can grow them remotely and publish a new version without an app update.

/** Languages the lexicon covers (stored full; mapped to app codes on read). */
export const lexiconLanguage = pgEnum("lexicon_language", ["en", "pidgin", "yoruba", "hausa", "igbo"]);
/** live = in the published lexicon; candidate = awaiting human review; rejected = dismissed. */
export const lexiconStatus = pgEnum("lexicon_status", ["live", "candidate", "rejected"]);
/** human = added/approved by an admin; gemini = AI-suggested (NEVER auto-live). */
export const lexiconSource = pgEnum("lexicon_source", ["human", "gemini", "curated", "dataset"]);

/**
 * A single lexicon term (the WORKING set — admins edit here). `category` and
 * `severity` are the classifier's CategoryName / SeverityName; kept as text +
 * validated at the endpoint (avoids enum churn on the 8 category names).
 */
export const lexiconTerms = pgTable(
  "lexicon_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    text: text("text").notNull(),
    language: lexiconLanguage("language").notNull(),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    status: lexiconStatus("status").notNull().default("candidate"),
    source: lexiconSource("source").notNull().default("human"),
    addedBy: text("added_by"),
    // Free-text rationale (e.g. the Gemini prompt/why, or a reviewer's note).
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // One term per (text, language, category) — same word can live in different
    // categories/languages, but not duplicated within one.
    uq: uniqueIndex("lexicon_term_uq").on(t.text, t.language, t.category),
    byStatus: index("lexicon_terms_status_idx").on(t.status),
  }),
);

/**
 * An immutable published snapshot. Publishing assembles all status=live terms
 * into `snapshot` (the exact JSON the app consumes) and bumps `version`. The app
 * reads the LATEST publication; edits to the working set don't reach the app
 * until the next publish. This is what "check version → maybe re-sync" rides on.
 */
export const lexiconPublications = pgTable("lexicon_publications", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: integer("version").notNull().unique(),
  snapshot: jsonb("snapshot").notNull(),
  liveCount: integer("live_count").notNull(),
  publishedBy: text("published_by"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export const datasetSources = pgTable("dataset_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  kind: text("kind").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>(),
  cursor: integer("cursor").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  totalPulled: integer("total_pulled").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const datasetExamples = pgTable(
  "dataset_examples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    text: text("text").notNull(),
    language: lexiconLanguage("language").notNull(),
    category: text("category"),
    severity: text("severity"),
    kind: text("kind").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull().default("candidate"),
    split: text("split").notNull().default("train"),
    modelTag: text("model_tag"),
    note: text("note"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex("dataset_example_uq").on(t.text, t.language),
    byStatus: index("dataset_examples_status_idx").on(t.status),
    bySource: index("dataset_examples_source_idx").on(t.source),
  }),
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    job: text("job").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    summary: jsonb("summary").$type<Record<string, unknown>>(),
    error: text("error"),
    triggeredBy: text("triggered_by"),
  },
  (t) => ({
    byJob: index("job_runs_job_started_idx").on(t.job, t.startedAt),
  }),
);

export type DatasetSource = typeof datasetSources.$inferSelect;
export type DatasetExample = typeof datasetExamples.$inferSelect;
export type NewDatasetExample = typeof datasetExamples.$inferInsert;
export type JobRun = typeof jobRuns.$inferSelect;

export type LexiconTerm = typeof lexiconTerms.$inferSelect;
export type NewLexiconTerm = typeof lexiconTerms.$inferInsert;
export type LexiconPublication = typeof lexiconPublications.$inferSelect;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;
