ALTER TABLE "service_desks" ADD COLUMN "accept_unknown_senders" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "service_desks" ADD COLUMN "allowed_domains" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_desks" ADD COLUMN "inbound_token_hash" text;--> statement-breakpoint
ALTER TABLE "service_desks" ADD COLUMN "inbound_token_created_at" timestamp with time zone;