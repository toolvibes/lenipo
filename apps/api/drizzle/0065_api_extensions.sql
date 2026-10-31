CREATE TABLE "idempotency_keys" (
	"caller" text NOT NULL,
	"key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"state" text DEFAULT 'running' NOT NULL,
	"status" integer,
	"body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_caller_key_pk" PRIMARY KEY("caller","key")
);
--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "registered_by_id" uuid;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "secret_hash" text;--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "tql" text;--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "space_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_registered_by_id_users_id_fk" FOREIGN KEY ("registered_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;