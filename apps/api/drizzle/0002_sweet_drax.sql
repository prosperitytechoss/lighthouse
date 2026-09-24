ALTER TABLE "devices" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "assignee" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "device_info" jsonb;