CREATE TYPE "public"."watch_kind" AS ENUM('page', 'subtree', 'space');--> statement-breakpoint
CREATE TABLE "page_watches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "watch_kind" NOT NULL,
	"space_id" uuid NOT NULL,
	"page_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_watches_unique" UNIQUE NULLS NOT DISTINCT("user_id","kind","space_id","page_id")
);
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "labels" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "page_watches" ADD CONSTRAINT "page_watches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_watches" ADD CONSTRAINT "page_watches_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_watches" ADD CONSTRAINT "page_watches_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_watches_page_idx" ON "page_watches" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_watches_space_idx" ON "page_watches" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "pages_labels_idx" ON "pages" USING gin ("labels");