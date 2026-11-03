CREATE TABLE "print_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title_page" boolean DEFAULT true NOT NULL,
	"logo" text,
	"subtitle" text DEFAULT '' NOT NULL,
	"header" text DEFAULT '' NOT NULL,
	"footer" text DEFAULT '' NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "print_template_id" uuid;