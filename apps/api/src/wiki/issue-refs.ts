import { issueRefs } from '@tasklore/editor';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { issues, pageIssueRefs } from '../db/schema/index.js';

/**
 * Rebuilds which issues a page refers to from its newly published content (W-INT-03, E-73);
 * keys of unknown or deleted issues are skipped.
 */
export async function indexIssueRefs(
  tx: Executor,
  pageId: string,
  content: unknown,
): Promise<void> {
  await tx.delete(pageIssueRefs).where(eq(pageIssueRefs.pageId, pageId));
  const refs = issueRefs(content);
  if (refs.length === 0) return;
  const kinds = new Map(refs.map((ref) => [ref.key, ref.kind]));
  const found = await tx
    .select({ id: issues.id, key: issues.key })
    .from(issues)
    .where(and(inArray(issues.key, [...kinds.keys()]), isNull(issues.deletedAt)));
  if (found.length === 0) return;
  await tx.insert(pageIssueRefs).values(
    found.map((issue) => ({
      pageId,
      issueId: issue.id,
      kind: kinds.get(issue.key) ?? 'mention',
    })),
  );
}
