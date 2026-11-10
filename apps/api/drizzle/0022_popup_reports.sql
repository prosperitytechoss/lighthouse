CREATE TABLE "popup_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"payload" text NOT NULL,
	"channel" text NOT NULL,
	"engine" text,
	"keeper_version" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "popup_reports" ADD CONSTRAINT "popup_reports_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "popup_reports" ADD CONSTRAINT "popup_reports_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "popup_reports_device_idx" ON "popup_reports" USING btree ("device_id","occurred_at");