CREATE TABLE "estimation_rounds" (
	"issue_id" uuid PRIMARY KEY NOT NULL,
	"started_by_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revealed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "estimation_votes" (
	"issue_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" text NOT NULL,
	"voted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimation_votes_issue_id_user_id_pk" PRIMARY KEY("issue_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "estimation_rounds" ADD CONSTRAINT "estimation_rounds_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimation_rounds" ADD CONSTRAINT "estimation_rounds_started_by_id_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimation_votes" ADD CONSTRAINT "estimation_votes_issue_id_estimation_rounds_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."estimation_rounds"("issue_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimation_votes" ADD CONSTRAINT "estimation_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;