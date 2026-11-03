CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"manifest_url" text NOT NULL,
	"origin" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"scopes" text[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"client_id" uuid NOT NULL,
	"installed_by_id" uuid,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_installed_by_id_users_id_fk" FOREIGN KEY ("installed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "apps_key_idx" ON "apps" USING btree ("key");