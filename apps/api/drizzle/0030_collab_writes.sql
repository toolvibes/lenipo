CREATE TABLE "collab_writes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document" text NOT NULL,
	"content" jsonb NOT NULL,
	"section" text,
	"new_heading" text,
	"actor_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
