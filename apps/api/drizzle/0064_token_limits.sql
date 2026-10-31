ALTER TABLE "personal_access_tokens" ADD COLUMN "rate_limit_per_minute" integer;--> statement-breakpoint
ALTER TABLE "personal_access_tokens" ADD COLUMN "daily_quota" integer;--> statement-breakpoint
ALTER TABLE "personal_access_tokens" ADD COLUMN "quota_day" date;--> statement-breakpoint
ALTER TABLE "personal_access_tokens" ADD COLUMN "quota_used" integer DEFAULT 0 NOT NULL;