CREATE TABLE "health_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
