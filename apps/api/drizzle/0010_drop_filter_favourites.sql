-- Saved-filter favourites move into the generic favourites table (E-46).
INSERT INTO "favourites" ("user_id", "kind", "target_id", "created_at")
SELECT "user_id", 'filter', "filter_id", "created_at" FROM "filter_favourites"
ON CONFLICT DO NOTHING;--> statement-breakpoint
DROP TABLE "filter_favourites" CASCADE;
