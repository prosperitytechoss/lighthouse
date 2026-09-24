ALTER TABLE "accounts" ADD COLUMN "weekly_digest_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "weekly_digest_sent_at" timestamp with time zone;