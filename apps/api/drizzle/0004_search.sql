CREATE TYPE "public"."filter_share_type" AS ENUM('user', 'group', 'project', 'authenticated');--> statement-breakpoint
CREATE TABLE "filter_favourites" (
	"user_id" uuid NOT NULL,
	"filter_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filter_favourites_user_id_filter_id_pk" PRIMARY KEY("user_id","filter_id")
);
--> statement-breakpoint
CREATE TABLE "filter_shares" (
	"id" uuid PRIMARY KEY NOT NULL,
	"filter_id" uuid NOT NULL,
	"type" "filter_share_type" NOT NULL,
	"user_id" uuid,
	"group_id" uuid,
	"project_id" uuid,
	CONSTRAINT "filter_shares_unique" UNIQUE NULLS NOT DISTINCT("filter_id","type","user_id","group_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "saved_filters" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"query" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_comments" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('german'::regconfig, coalesce(body_text, '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(body_text, '')), 'A')) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('german'::regconfig, coalesce(summary, '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(summary, '')), 'A') || setweight(to_tsvector('german'::regconfig, coalesce(description_text, '')), 'B') || setweight(to_tsvector('english'::regconfig, coalesce(description_text, '')), 'B')) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "filter_favourites" ADD CONSTRAINT "filter_favourites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filter_favourites" ADD CONSTRAINT "filter_favourites_filter_id_saved_filters_id_fk" FOREIGN KEY ("filter_id") REFERENCES "public"."saved_filters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filter_shares" ADD CONSTRAINT "filter_shares_filter_id_saved_filters_id_fk" FOREIGN KEY ("filter_id") REFERENCES "public"."saved_filters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filter_shares" ADD CONSTRAINT "filter_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filter_shares" ADD CONSTRAINT "filter_shares_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filter_shares" ADD CONSTRAINT "filter_shares_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "filter_shares_filter_idx" ON "filter_shares" USING btree ("filter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_filters_owner_name_unique" ON "saved_filters" USING btree ("owner_id",lower("name"));--> statement-breakpoint
CREATE INDEX "issue_comments_search_idx" ON "issue_comments" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "issues_search_idx" ON "issues" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "issues_created_idx" ON "issues" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "issues_updated_idx" ON "issues" USING btree ("updated_at");