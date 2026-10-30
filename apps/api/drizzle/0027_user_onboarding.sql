ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
-- Everyone who exists already counts as onboarded (E-71).
UPDATE "users" SET "onboarded_at" = now();
