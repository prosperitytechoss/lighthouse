CREATE TYPE "public"."lexicon_language" AS ENUM('en', 'pidgin', 'yoruba', 'hausa', 'igbo');--> statement-breakpoint
CREATE TYPE "public"."lexicon_source" AS ENUM('human', 'gemini');--> statement-breakpoint
CREATE TYPE "public"."lexicon_status" AS ENUM('live', 'candidate', 'rejected');--> statement-breakpoint
CREATE TABLE "lexicon_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"live_count" integer NOT NULL,
	"published_by" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lexicon_publications_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "lexicon_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"language" "lexicon_language" NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"status" "lexicon_status" DEFAULT 'candidate' NOT NULL,
	"source" "lexicon_source" DEFAULT 'human' NOT NULL,
	"added_by" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "lexicon_term_uq" ON "lexicon_terms" USING btree ("text","language","category");--> statement-breakpoint
CREATE INDEX "lexicon_terms_status_idx" ON "lexicon_terms" USING btree ("status");