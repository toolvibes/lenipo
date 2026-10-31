CREATE TABLE "saml_providers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"idp_entity_id" text NOT NULL,
	"sso_url" text NOT NULL,
	"certificates" text[] NOT NULL,
	"email_attribute" text DEFAULT 'email' NOT NULL,
	"name_attribute" text DEFAULT 'displayName' NOT NULL,
	"groups_attribute" text DEFAULT '' NOT NULL,
	"create_users" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
