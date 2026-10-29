CREATE TYPE "public"."favourite_kind" AS ENUM('project', 'filter');--> statement-breakpoint
CREATE TYPE "public"."recent_kind" AS ENUM('issue', 'project');--> statement-breakpoint
CREATE TABLE "favourites" (
	"user_id" uuid NOT NULL,
	"kind" "favourite_kind" NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favourites_user_id_kind_target_id_pk" PRIMARY KEY("user_id","kind","target_id")
);
--> statement-breakpoint
CREATE TABLE "recent_items" (
	"user_id" uuid NOT NULL,
	"kind" "recent_kind" NOT NULL,
	"target_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recent_items_user_id_kind_target_id_pk" PRIMARY KEY("user_id","kind","target_id")
);
--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_items" ADD CONSTRAINT "recent_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favourites_target_idx" ON "favourites" USING btree ("kind","target_id");--> statement-breakpoint
CREATE INDEX "recent_items_user_idx" ON "recent_items" USING btree ("user_id","viewed_at");