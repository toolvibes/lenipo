ALTER TABLE "project_custom_fields" ADD COLUMN "required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_custom_fields" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_custom_fields" ADD COLUMN "description" text;