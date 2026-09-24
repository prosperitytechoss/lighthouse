import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Load .env into process.env before validating.
loadDotenv();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection URL"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid connection URL"),
  // Email (Resend). Optional: when RESEND_API_KEY is absent we fall back to a
  // dev transport that logs OTPs to the console, so the flow runs without a key.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Lighthouse <noreply@updates.prosperitytech.org>"),
  // Public base URL of THIS api, used to build the email-confirmation link that
  // the parent taps to verify their address after child-device setup.
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),
  // Application-layer encryption of signal content at rest (AES-256-GCM).
  // 32-byte key, hex-encoded (64 chars). Generate: openssl rand -hex 32
  SIGNAL_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "SIGNAL_ENCRYPTION_KEY must be 64 hex chars (32 bytes)"),
  // Hours of no check-in before a device is flagged "silent" and the parent is
  // alerted. Sane default; tune per cohort.
  SILENCE_HOURS: z.coerce.number().positive().default(6),
  // Background jobs (silence check, weekly summary) send real parent emails.
  // They run automatically in production only; a local dev process must opt
  // in explicitly so a laptop can never email parents from a stale local DB.
  RUN_SCHEDULERS: z.enum(["true", "false"]).optional(),
  // Weekly parent summary: send on this local weekday (0=Sunday) from this hour,
  // in this IANA timezone. Sunday morning West Africa Time by default — a
  // reflective, lower-pressure day for the pilot cohort (Nigeria).
  WEEKLY_DIGEST_TZ: z.string().default("Africa/Lagos"),
  WEEKLY_DIGEST_DAY: z.coerce.number().int().min(0).max(6).default(0),
  WEEKLY_DIGEST_HOUR: z.coerce.number().int().min(0).max(23).default(8),
  // Lexicon Admin: comma-separated allow-list of admin emails (magic-link login).
  // Only these may manage the lexicon. Empty = no admins (dashboard locked out).
  ADMIN_EMAILS: z.string().default(""),
  // Base URL of the admin dashboard, used to build the magic-link callback URL.
  ADMIN_APP_URL: z.string().default("http://localhost:5173"),
  // Gemini (candidate generation). Optional — absent = generation disabled, the
  // rest of the dashboard still works. Model name is configurable (not pinned in
  // code); verified against the API at call time.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  HF_TOKEN: z.string().optional(),
  HARVEST_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v !== "false" && v !== "0"),
  HARVEST_INTERVAL_MINUTES: z.coerce.number().positive().default(360),
  HARVEST_BATCH: z.coerce.number().int().positive().default(200),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: a misconfigured server should never boot half-wired.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env: Env = parsed.data;
export const isProd = env.NODE_ENV === "production";
