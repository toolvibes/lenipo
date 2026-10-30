import type { Executor } from '../db/client.js';
import { domainEvents } from '../db/schema/index.js';
import { signalIssue } from '../realtime/signals.js';

/** A changed field with machine values (for rules) and display values (for people). */
export interface ChangedItem {
  field: string;
  fromValue: string | null;
  toValue: string | null;
  fromDisplay: string | null;
  toDisplay: string | null;
}

/** What happened to an issue; written to the outbox in the transaction of the change (E-44). */
export type IssueEvent =
  | { type: 'issue.created'; mentions: string[] }
  | { type: 'issue.updated'; items: ChangedItem[]; mentions: string[] }
  | {
      type: 'issue.commented';
      commentId: string;
      excerpt: string;
      mentions: string[];
      /** An edit: only people mentioned for the first time are told. */
      edited: boolean;
    }
  | { type: 'issue.comment_deleted'; commentId: string }
  | {
      type: 'issue.worklog';
      action: 'created' | 'updated' | 'deleted';
      worklogId: string;
      timeSpentSeconds: number;
    };

export async function emitIssueEvent(
  tx: Executor,
  issueId: string,
  actorId: string | null,
  event: IssueEvent,
): Promise<void> {
  const { type, ...payload } = event;
  await tx.insert(domainEvents).values({ type, issueId, actorId, payload });
  // Open boards and issue pages hear about it once this commits (E-58).
  await signalIssue(tx, issueId);
}

/** What happened on a wiki page (E-63); written to the outbox with the page's id. */
export type PageEvent = {
  type: 'page.commented';
  commentId: string;
  /** The comment that starts the thread; the comment itself for a new thread. */
  threadId: string;
  excerpt: string;
  /** The quoted text of an inline thread. */
  quote: string | null;
  mentions: string[];
  /** An edit: only people mentioned for the first time are told. */
  edited: boolean;
};

export async function emitPageEvent(
  tx: Executor,
  pageId: string,
  actorId: string | null,
  event: PageEvent,
): Promise<void> {
  const { type, ...payload } = event;
  await tx.insert(domainEvents).values({ type, pageId, actorId, payload });
}
