CREATE TABLE "issue_key_aliases" (
	"key" text PRIMARY KEY NOT NULL,
	"issue_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_key_aliases" ADD CONSTRAINT "issue_key_aliases_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;