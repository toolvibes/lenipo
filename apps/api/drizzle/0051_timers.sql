CREATE TABLE "issue_timers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"issue_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_timers" ADD CONSTRAINT "issue_timers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_timers" ADD CONSTRAINT "issue_timers_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;