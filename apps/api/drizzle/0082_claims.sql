CREATE TABLE "issue_claims" (
	"issue_id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"branch" text,
	"paths" text[] DEFAULT '{}'::text[] NOT NULL,
	"forced" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD COLUMN "task_filter" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_claims" ADD CONSTRAINT "issue_claims_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_claims" ADD CONSTRAINT "issue_claims_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_claims" ADD CONSTRAINT "issue_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_claims_project_idx" ON "issue_claims" USING btree ("project_id","expires_at");--> statement-breakpoint
CREATE INDEX "issue_claims_user_idx" ON "issue_claims" USING btree ("user_id");