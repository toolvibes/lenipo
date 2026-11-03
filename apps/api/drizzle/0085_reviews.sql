CREATE TABLE "review_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"issue_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"verdict" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "review_approved_status_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "review_changes_status_id" uuid;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_requests_issue_idx" ON "review_requests" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "review_requests_reviewer_idx" ON "review_requests" USING btree ("reviewer_id","status");