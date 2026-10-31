CREATE TYPE "public"."page_restriction_kind" AS ENUM('view', 'edit');--> statement-breakpoint
CREATE TABLE "page_restrictions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"page_id" uuid NOT NULL,
	"kind" "page_restriction_kind" NOT NULL,
	"user_id" uuid,
	"group_id" uuid,
	CONSTRAINT "page_restrictions_one_target" CHECK ((user_id is null) <> (group_id is null))
);
--> statement-breakpoint
ALTER TABLE "page_restrictions" ADD CONSTRAINT "page_restrictions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_restrictions" ADD CONSTRAINT "page_restrictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_restrictions" ADD CONSTRAINT "page_restrictions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_restrictions_page_idx" ON "page_restrictions" USING btree ("page_id","kind");