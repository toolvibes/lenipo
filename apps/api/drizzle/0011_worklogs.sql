CREATE TABLE "issue_worklogs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"issue_id" uuid NOT NULL,
	"author_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"time_spent_seconds" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_worklogs_positive" CHECK ("issue_worklogs"."time_spent_seconds" > 0)
);
--> statement-breakpoint
ALTER TABLE "issue_worklogs" ADD CONSTRAINT "issue_worklogs_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_worklogs" ADD CONSTRAINT "issue_worklogs_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_worklogs_issue_idx" ON "issue_worklogs" USING btree ("issue_id","started_at");--> statement-breakpoint
CREATE INDEX "issue_worklogs_author_idx" ON "issue_worklogs" USING btree ("author_id","started_at");