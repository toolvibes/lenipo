CREATE TYPE "public"."estimation_field" AS ENUM('storyPoints', 'originalEstimate', 'issueCount');--> statement-breakpoint
CREATE TYPE "public"."sprint_state" AS ENUM('future', 'active', 'closed');--> statement-breakpoint
CREATE TABLE "sprint_issues" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sprint_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"added_after_start" boolean DEFAULT false NOT NULL,
	"estimate_at_start" numeric(12, 1),
	"estimate_at_completion" numeric(12, 1),
	"completed" boolean
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"state" "sprint_state" DEFAULT 'future' NOT NULL,
	"start_date" date,
	"end_date" date,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"estimation" "estimation_field",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "estimation" "estimation_field" DEFAULT 'storyPoints' NOT NULL;--> statement-breakpoint
ALTER TABLE "sprint_issues" ADD CONSTRAINT "sprint_issues_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_issues" ADD CONSTRAINT "sprint_issues_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sprint_issues_sprint_idx" ON "sprint_issues" USING btree ("sprint_id");--> statement-breakpoint
CREATE INDEX "sprint_issues_issue_idx" ON "sprint_issues" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "sprints_board_idx" ON "sprints" USING btree ("board_id","state");