DROP INDEX "issues_project_created_idx";--> statement-breakpoint
DROP INDEX "issues_project_updated_idx";--> statement-breakpoint
CREATE INDEX "issues_project_created_id_idx" ON "issues" USING btree ("project_id","created_at","id") WHERE "issues"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "issues_project_updated_id_idx" ON "issues" USING btree ("project_id","updated_at","id") WHERE "issues"."deleted_at" is null;