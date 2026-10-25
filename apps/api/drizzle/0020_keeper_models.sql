CREATE TABLE "keeper_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"onnx" "bytea",
	"spm" "bytea",
	"onnx_sha256" text,
	"spm_sha256" text,
	"onnx_bytes" integer,
	"spm_bytes" integer,
	"notes" text,
	"min_risk" double precision DEFAULT 0.8 NOT NULL,
	"live" boolean DEFAULT false NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "keeper_models_version_unique" UNIQUE("version")
);
