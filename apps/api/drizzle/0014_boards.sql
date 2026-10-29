CREATE TYPE "public"."board_type" AS ENUM('kanban', 'scrum');--> statement-breakpoint
CREATE TYPE "public"."swimlane_mode" AS ENUM('none', 'epic', 'assignee');--> statement-breakpoint
CREATE TABLE "board_column_statuses" (
	"board_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"status_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "board_column_statuses_board_id_status_id_pk" PRIMARY KEY("board_id","status_id")
);
--> statement-breakpoint
CREATE TABLE "board_columns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"wip_min" integer,
	"wip_max" integer
);
--> statement-breakpoint
CREATE TABLE "board_quick_filters" (
	"id" uuid PRIMARY KEY NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "board_type" NOT NULL,
	"project_id" uuid NOT NULL,
	"query" text NOT NULL,
	"swimlanes" "swimlane_mode" DEFAULT 'none' NOT NULL,
	"hide_done_after_days" integer DEFAULT 14,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_column_statuses" ADD CONSTRAINT "board_column_statuses_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_column_statuses" ADD CONSTRAINT "board_column_statuses_column_id_board_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."board_columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_column_statuses" ADD CONSTRAINT "board_column_statuses_status_id_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."statuses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_quick_filters" ADD CONSTRAINT "board_quick_filters_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_column_statuses_column_idx" ON "board_column_statuses" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX "board_columns_board_idx" ON "board_columns" USING btree ("board_id","position");--> statement-breakpoint
CREATE INDEX "board_quick_filters_board_idx" ON "board_quick_filters" USING btree ("board_id");--> statement-breakpoint
CREATE UNIQUE INDEX "board_quick_filters_name_unique" ON "board_quick_filters" USING btree ("board_id",lower("name"));--> statement-breakpoint
CREATE INDEX "boards_project_idx" ON "boards" USING btree ("project_id");