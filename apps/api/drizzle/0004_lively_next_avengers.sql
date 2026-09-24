CREATE TYPE "public"."signal_source" AS ENUM('synthetic', 'real');--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"payload" text NOT NULL,
	"source" "signal_source" DEFAULT 'synthetic' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signals_account_occurred_idx" ON "signals" USING btree ("account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "signals_device_occurred_idx" ON "signals" USING btree ("device_id","occurred_at");