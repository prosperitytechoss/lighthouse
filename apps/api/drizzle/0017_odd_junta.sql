ALTER TYPE "public"."lexicon_source" ADD VALUE 'curated';--> statement-breakpoint
ALTER TYPE "public"."lexicon_source" ADD VALUE 'dataset';--> statement-breakpoint
CREATE TABLE "dataset_examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"language" "lexicon_language" NOT NULL,
	"category" text,
	"severity" text,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"split" text DEFAULT 'train' NOT NULL,
	"note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dataset_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"config" jsonb,
	"cursor" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"total_pulled" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dataset_sources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"summary" jsonb,
	"error" text,
	"triggered_by" text
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "vision_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "vision_supported" boolean;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "vision_tier" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "vision_interval_ms" integer;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "vision_frames" integer;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "vision_last_frame_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "channel" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "dataset_example_uq" ON "dataset_examples" USING btree ("text","language");--> statement-breakpoint
CREATE INDEX "dataset_examples_status_idx" ON "dataset_examples" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dataset_examples_source_idx" ON "dataset_examples" USING btree ("source");--> statement-breakpoint
CREATE INDEX "job_runs_job_started_idx" ON "job_runs" USING btree ("job","started_at");