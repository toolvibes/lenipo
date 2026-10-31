CREATE TABLE "automation_queue" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"rule_id" uuid NOT NULL,
	"issue_id" uuid,
	"initiator_id" uuid,
	"depth" integer DEFAULT 1 NOT NULL,
	"trigger" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"owner_id" uuid,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger" jsonb NOT NULL,
	"components" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allow_self_trigger" boolean DEFAULT false NOT NULL,
	"webhook_token" text,
	"disabled_reason" text,
	"last_scheduled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"rule_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"trigger" text NOT NULL,
	"issue_key" text,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domain_events" ADD COLUMN "automation_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "domain_events" ADD COLUMN "automation_depth" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_queue" ADD CONSTRAINT "automation_queue_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_queue" ADD CONSTRAINT "automation_queue_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_queue" ADD CONSTRAINT "automation_queue_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_rules_project_idx" ON "automation_rules" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "automation_runs_rule_idx" ON "automation_runs" USING btree ("rule_id","started_at");