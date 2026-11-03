CREATE TABLE "mail_handlers" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 993 NOT NULL,
	"secure" boolean DEFAULT true NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"folder" text DEFAULT 'INBOX' NOT NULL,
	"done_folder" text DEFAULT '' NOT NULL,
	"issue_type_id" uuid NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_result" text
);
--> statement-breakpoint
CREATE TABLE "mail_receipts" (
	"project_id" uuid NOT NULL,
	"message_id" text NOT NULL,
	"issue_key" text,
	"outcome" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_receipts_project_id_message_id_pk" PRIMARY KEY("project_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "mail_handlers" ADD CONSTRAINT "mail_handlers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_receipts" ADD CONSTRAINT "mail_receipts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;