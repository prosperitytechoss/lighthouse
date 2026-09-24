ALTER TABLE "accounts" ADD COLUMN "alert_threshold" text DEFAULT 'severe' NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "silence_alerted_at" timestamp with time zone;