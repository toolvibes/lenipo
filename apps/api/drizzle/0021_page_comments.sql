CREATE TABLE "page_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"page_id" uuid NOT NULL,
	"parent_id" uuid,
	"author_id" uuid,
	"body" jsonb NOT NULL,
	"body_text" text NOT NULL,
	"anchor" jsonb,
	"detached" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "page_comments" ADD CONSTRAINT "page_comments_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_comments" ADD CONSTRAINT "page_comments_parent_id_page_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_comments" ADD CONSTRAINT "page_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_comments" ADD CONSTRAINT "page_comments_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_comments_page_idx" ON "page_comments" USING btree ("page_id","created_at");--> statement-breakpoint
CREATE INDEX "page_comments_parent_idx" ON "page_comments" USING btree ("parent_id");