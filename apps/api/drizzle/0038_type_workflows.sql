CREATE TABLE "project_type_workflows" (
	"project_id" uuid NOT NULL,
	"issue_type_id" uuid NOT NULL,
	"workflow_version_id" uuid NOT NULL,
	CONSTRAINT "project_type_workflows_project_id_issue_type_id_pk" PRIMARY KEY("project_id","issue_type_id")
);
--> statement-breakpoint
ALTER TABLE "project_type_workflows" ADD CONSTRAINT "project_type_workflows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_type_workflows" ADD CONSTRAINT "project_type_workflows_issue_type_id_issue_types_id_fk" FOREIGN KEY ("issue_type_id") REFERENCES "public"."issue_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_type_workflows" ADD CONSTRAINT "project_type_workflows_workflow_version_id_workflow_versions_id_fk" FOREIGN KEY ("workflow_version_id") REFERENCES "public"."workflow_versions"("id") ON DELETE no action ON UPDATE no action;