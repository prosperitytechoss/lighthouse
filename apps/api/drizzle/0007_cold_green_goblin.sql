ALTER TABLE "devices" ADD COLUMN "accessibility_enabled" boolean;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "notification_access_enabled" boolean;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "battery_optimization_exempt" boolean;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "tamper_alerted_at" timestamp with time zone;