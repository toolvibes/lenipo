ALTER TYPE "public"."favourite_kind" ADD VALUE 'space';--> statement-breakpoint
ALTER TYPE "public"."favourite_kind" ADD VALUE 'page';--> statement-breakpoint
ALTER TYPE "public"."recent_kind" ADD VALUE 'space';--> statement-breakpoint
ALTER TYPE "public"."recent_kind" ADD VALUE 'page';--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spaces_project_idx" ON "spaces" USING btree ("project_id");