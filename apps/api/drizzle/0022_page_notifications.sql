DROP INDEX "notifications_email_idx";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "issue_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_events" ADD COLUMN "page_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "page_id" uuid;--> statement-breakpoint
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_email_idx" ON "notifications" USING btree ("user_id","issue_id","page_id") WHERE "notifications"."email_pending";--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_subject" CHECK (num_nonnulls("notifications"."issue_id", "notifications"."page_id") = 1);