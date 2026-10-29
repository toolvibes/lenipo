CREATE TYPE "public"."version_kind" AS ENUM('fix', 'affects');--> statement-breakpoint
CREATE TABLE "issue_versions" (
	"issue_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"kind" "version_kind" NOT NULL,
	CONSTRAINT "issue_versions_issue_id_version_id_kind_pk" PRIMARY KEY("issue_id","version_id","kind")
);
--> statement-breakpoint
CREATE TABLE "project_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"start_date" date,
	"release_date" date,
	"released" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_versions" ADD CONSTRAINT "issue_versions_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_versions" ADD CONSTRAINT "issue_versions_version_id_project_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."project_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_versions_version_idx" ON "issue_versions" USING btree ("version_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "project_versions_name_unique" ON "project_versions" USING btree ("project_id",lower("name"));