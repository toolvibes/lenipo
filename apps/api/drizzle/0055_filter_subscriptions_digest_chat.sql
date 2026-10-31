CREATE TABLE "filter_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"filter_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid,
	"schedule" text NOT NULL,
	"weekday" integer DEFAULT 1 NOT NULL,
	"hour" integer DEFAULT 8 NOT NULL,
	"only_with_results" boolean DEFAULT true NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "email_mode" text DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "digest_hour" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "notify_own_changes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "last_digest_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "format" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "locale" text DEFAULT 'de' NOT NULL;--> statement-breakpoint
ALTER TABLE "filter_subscriptions" ADD CONSTRAINT "filter_subscriptions_filter_id_saved_filters_id_fk" FOREIGN KEY ("filter_id") REFERENCES "public"."saved_filters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filter_subscriptions" ADD CONSTRAINT "filter_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filter_subscriptions" ADD CONSTRAINT "filter_subscriptions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "filter_subscriptions_filter_idx" ON "filter_subscriptions" USING btree ("filter_id");