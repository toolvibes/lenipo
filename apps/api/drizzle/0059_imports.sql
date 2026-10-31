CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"dry_run" boolean NOT NULL,
	"label" text NOT NULL,
	"params" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"progress" text DEFAULT '' NOT NULL,
	"log" text[] DEFAULT '{}' NOT NULL,
	"report" jsonb,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "import_mappings" (
	"origin" text NOT NULL,
	"kind" text NOT NULL,
	"source_id" text NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_mappings_unique" ON "import_mappings" USING btree ("origin","kind","source_id");--> statement-breakpoint
CREATE INDEX "import_mappings_target_idx" ON "import_mappings" USING btree ("target_id");