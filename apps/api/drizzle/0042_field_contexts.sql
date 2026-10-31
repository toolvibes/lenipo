ALTER TABLE "project_custom_fields" ADD COLUMN "issue_type_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "project_custom_fields" ADD COLUMN "option_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "project_custom_fields" ADD COLUMN "default_value" jsonb;