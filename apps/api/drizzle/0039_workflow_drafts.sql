CREATE TABLE "workflow_drafts" (
	"project_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"request" jsonb NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_drafts_project_id_scope_pk" PRIMARY KEY("project_id","scope")
);
--> statement-breakpoint
ALTER TABLE "workflow_drafts" ADD CONSTRAINT "workflow_drafts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_drafts" ADD CONSTRAINT "workflow_drafts_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;