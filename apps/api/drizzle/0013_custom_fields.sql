CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'textarea', 'number', 'date', 'datetime', 'select', 'multiselect', 'user', 'checkbox', 'url');--> statement-breakpoint
CREATE TABLE "custom_field_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"field_id" uuid NOT NULL,
	"value" text NOT NULL,
	"position" integer NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_fields" (
	"id" uuid PRIMARY KEY NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "custom_fields_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" "custom_field_type" NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_custom_fields" (
	"project_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "project_custom_fields_project_id_field_id_pk" PRIMARY KEY("project_id","field_id")
);
--> statement-breakpoint
ALTER TABLE "custom_field_options" ADD CONSTRAINT "custom_field_options_field_id_custom_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."custom_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_custom_fields" ADD CONSTRAINT "project_custom_fields_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_custom_fields" ADD CONSTRAINT "project_custom_fields_field_id_custom_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."custom_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_field_options_field_idx" ON "custom_field_options" USING btree ("field_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_options_value_unique" ON "custom_field_options" USING btree ("field_id",lower("value"));--> statement-breakpoint
CREATE UNIQUE INDEX "custom_fields_name_unique" ON "custom_fields" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "custom_fields_number_unique" ON "custom_fields" USING btree ("number");--> statement-breakpoint
CREATE INDEX "project_custom_fields_field_idx" ON "project_custom_fields" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "issues_custom_fields_idx" ON "issues" USING gin ("custom_fields");