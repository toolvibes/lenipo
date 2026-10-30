CREATE TABLE "page_issue_refs" (
	"page_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "page_issue_refs_page_id_issue_id_pk" PRIMARY KEY("page_id","issue_id")
);
--> statement-breakpoint
ALTER TABLE "page_issue_refs" ADD CONSTRAINT "page_issue_refs_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_issue_refs" ADD CONSTRAINT "page_issue_refs_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_issue_refs_issue_idx" ON "page_issue_refs" USING btree ("issue_id");--> statement-breakpoint
-- Backfill from the latest published versions (E-73): keys in the plain text and issue macros.
-- Text inside code counts here once; the next publish of a page applies the exact rules.
INSERT INTO "page_issue_refs" ("page_id", "issue_id", "kind")
SELECT refs.page_id, i.id, min(refs.kind)
FROM (
  SELECT v.page_id, m[1] AS key, 'mention' AS kind
  FROM "page_versions" v
  JOIN "pages" p ON p.id = v.page_id AND p.version = v.number
  CROSS JOIN LATERAL regexp_matches(v.text, '(?<![[:alnum:]-])([A-Z][A-Z0-9]{1,9}-[1-9][0-9]*)(?![[:alnum:]])', 'g') AS m
  UNION ALL
  SELECT v.page_id, k #>> '{}' AS key, 'macro' AS kind
  FROM "page_versions" v
  JOIN "pages" p ON p.id = v.page_id AND p.version = v.number
  CROSS JOIN LATERAL jsonb_path_query(v.content, 'strict $.** ? (@.type == "issue").attrs.key') AS k
) refs
JOIN "issues" i ON i.key = refs.key AND i.deleted_at IS NULL
GROUP BY refs.page_id, i.id
ON CONFLICT DO NOTHING;
