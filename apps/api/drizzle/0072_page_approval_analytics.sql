ALTER TYPE "public"."space_role" ADD VALUE 'approvers';--> statement-breakpoint
CREATE TABLE "page_submissions" (
	"page_id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"author_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rejected_at" timestamp with time zone,
	"rejected_by_id" uuid,
	"rejection_comment" text
);
--> statement-breakpoint
CREATE TABLE "page_view_counts" (
	"page_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer NOT NULL,
	"readers" integer NOT NULL,
	CONSTRAINT "page_view_counts_page_id_day_pk" PRIMARY KEY("page_id","day")
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"page_id" uuid NOT NULL,
	"day" date NOT NULL,
	"user_id" uuid NOT NULL,
	"views" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "page_views_page_id_day_user_id_pk" PRIMARY KEY("page_id","day","user_id")
);
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "approval_mode" text DEFAULT 'space' NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "approval_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "page_submissions" ADD CONSTRAINT "page_submissions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_submissions" ADD CONSTRAINT "page_submissions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_submissions" ADD CONSTRAINT "page_submissions_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_view_counts" ADD CONSTRAINT "page_view_counts_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_views_day_idx" ON "page_views" USING btree ("day");