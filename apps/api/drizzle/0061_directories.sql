CREATE TABLE "directories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"position" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"last_sync_at" timestamp with time zone,
	"last_sync_result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "directory_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "directory_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "external_id" text;