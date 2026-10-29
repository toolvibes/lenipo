import { reanchor } from '@tasklore/editor';
import type { TextAnchor } from '@tasklore/shared';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { pageComments } from '../db/schema/index.js';

/**
 * Moves the inline comments of a page onto newly published content (E-63): each quote is
 * looked up again; quotes that are gone mark their thread as detached, and come back if the
 * text returns. Runs in the transaction that stores the version.
 */
export async function reanchorComments(tx: Executor, pageId: string, content: unknown) {
  const threads = await tx
    .select({ id: pageComments.id, anchor: pageComments.anchor })
    .from(pageComments)
    .where(
      and(
        eq(pageComments.pageId, pageId),
        isNull(pageComments.parentId),
        isNotNull(pageComments.anchor),
      ),
    );
  for (const thread of threads) {
    const moved = reanchor(content, thread.anchor as TextAnchor);
    await tx
      .update(pageComments)
      .set(moved ? { anchor: moved, detached: false } : { detached: true })
      .where(eq(pageComments.id, thread.id));
  }
}
