ALTER TABLE "accounts" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "whatsapp_number" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "email_alerts_enabled" boolean DEFAULT true NOT NULL;