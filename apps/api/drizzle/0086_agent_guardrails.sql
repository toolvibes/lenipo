CREATE TABLE "agent_budget_alerts" (
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"metric" text NOT NULL,
	"level" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_budget_alerts_user_id_period_metric_level_pk" PRIMARY KEY("user_id","period","metric","level")
);
--> statement-breakpoint
CREATE TABLE "agent_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"via" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"issue_key" text,
	"problem" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_usage" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"issues" integer DEFAULT 0 NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "agent_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "issue_approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"issue_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"to_status_id" uuid NOT NULL,
	"request" jsonb NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_subject";--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD COLUMN "paused_by_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD COLUMN "pause_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD COLUMN "budget" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "agent_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "agents_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "agents_paused_by_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "agents_pause_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "agent_approval_status_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_budget_alerts" ADD CONSTRAINT "agent_budget_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_usage" ADD CONSTRAINT "agent_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_requests_user_idx" ON "agent_requests" USING btree ("user_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_approvals_pending" ON "issue_approvals" USING btree ("issue_id") WHERE "issue_approvals"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "issue_approvals_project_idx" ON "issue_approvals" USING btree ("project_id","status");--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_paused_by_id_users_id_fk" FOREIGN KEY ("paused_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_subject" CHECK (num_nonnulls("notifications"."issue_id", "notifications"."page_id", "notifications"."sprint_id", "notifications"."agent_id") = 1);