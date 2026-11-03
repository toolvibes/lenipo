CREATE TABLE "sprint_approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sprint_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"action" text NOT NULL,
	"request" jsonb NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_agent_roles" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"roles" text[] NOT NULL,
	CONSTRAINT "project_agent_roles_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_subject";--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "sprint_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "agent_sprint_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sprint_approvals" ADD CONSTRAINT "sprint_approvals_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_approvals" ADD CONSTRAINT "sprint_approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_approvals" ADD CONSTRAINT "sprint_approvals_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_approvals" ADD CONSTRAINT "sprint_approvals_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_agent_roles" ADD CONSTRAINT "project_agent_roles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_agent_roles" ADD CONSTRAINT "project_agent_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sprint_approvals_pending" ON "sprint_approvals" USING btree ("sprint_id","action") WHERE "sprint_approvals"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "sprint_approvals_project_idx" ON "sprint_approvals" USING btree ("project_id","status");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_subject" CHECK (num_nonnulls("notifications"."issue_id", "notifications"."page_id", "notifications"."sprint_id") = 1);