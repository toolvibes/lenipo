import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import { and, eq, isNull, like, or, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import * as Y from 'yjs';
import { DRAFT_FIELD, DRAFT_WRITE_CHANNEL } from '../collab/document-name.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Transaction } from '../db/client.js';
import {
  collabDocuments,
  collabWrites,
  dashboardHomes,
  favourites,
  filterSubscriptions,
  groupMembers,
  invitations,
  issueChangeItems,
  issueComments,
  issues,
  issueTimers,
  issueWatchers,
  notificationSettings,
  notifications,
  oauthGrants,
  pageComments,
  pageTemplates,
  pageVersions,
  pageWatches,
  personalAccessTokens,
  recentItems,
  recoveryCodes,
  sessions,
  userIdentities,
  userPreferences,
  users,
} from '../db/schema/index.js';
import { plainText } from '../tracking/rich-text.js';

/** Domain of the addresses anonymised accounts get; `.invalid` never delivers (RFC 2606). */
export const ANONYMOUS_DOMAIN = 'anonymized.invalid';

interface Node {
  type?: unknown;
  attrs?: Record<string, unknown>;
  content?: unknown;
}

/** The document with every mention of the person relabelled; null when nothing changed. */
export function relabelMentions(doc: unknown, userId: string, label: string): unknown | null {
  let changed = false;
  const walk = (node: Node): Node => {
    let next = node;
    if (node.type === 'mention' && node.attrs?.id === userId && node.attrs.label !== label) {
      changed = true;
      next = { ...node, attrs: { ...node.attrs, label } };
    }
    if (Array.isArray(node.content))
      next = { ...next, content: node.content.map((child) => walk((child ?? {}) as Node)) };
    return next;
  };
  if (!doc || typeof doc !== 'object') return null;
  const result = walk(doc as Node);
  return changed ? result : null;
}

/**
 * Deactivating, reactivating and anonymising accounts (TL-39, E-120). Anonymising keeps
 * everything the person did, under "Ehemalige Person n", and removes what identifies them.
 */
@Injectable()
export class UserLifecycleService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  private async user(id: string, actorId: string) {
    if (id === actorId) throw new BadRequestException('You cannot do this to your own account');
    const [row] = await this.database.db.select().from(users).where(eq(users.id, id));
    if (!row) throw new NotFoundException('User not found');
    return row;
  }

  /** Ends sessions, tokens and app connections; sign-ins stop because of the status. */
  private async cutAccess(tx: Transaction, id: string): Promise<void> {
    await tx
      .update(sessions)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)));
    await tx
      .update(personalAccessTokens)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(personalAccessTokens.userId, id), isNull(personalAccessTokens.revokedAt)));
    await tx
      .update(oauthGrants)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(oauthGrants.userId, id), isNull(oauthGrants.revokedAt)));
  }

  async deactivate(id: string, actorId: string): Promise<void> {
    await this.user(id, actorId);
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ status: 'deactivated', updatedAt: sql`now()` })
        .where(eq(users.id, id));
      await this.cutAccess(tx, id);
    });
  }

  async reactivate(id: string, actorId: string): Promise<void> {
    const user = await this.user(id, actorId);
    if (user.email.endsWith(`@${ANONYMOUS_DOMAIN}`))
      throw new BadRequestException('An anonymised account cannot be reactivated');
    await this.database.db
      .update(users)
      .set({ status: 'active', updatedAt: sql`now()` })
      .where(eq(users.id, id));
  }

  /**
   * Replaces name and e-mail everywhere they were copied to, removes sign-in data and
   * personal settings, and returns the new name. `confirmation` must be the current name.
   */
  async anonymize(id: string, actorId: string, confirmation: string): Promise<string> {
    const user = await this.user(id, actorId);
    if (user.email.endsWith(`@${ANONYMOUS_DOMAIN}`))
      throw new BadRequestException('This account is already anonymised');
    if (confirmation.trim() !== user.displayName)
      throw new BadRequestException('Type the name of the person to confirm');
    const drafts: Array<{ name: string; content: unknown }> = [];
    const label = await this.database.db.transaction(async (tx) => {
      // Serialises numbering when two accounts are anonymised at once.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('lenipo.anonymize'))`);
      const [count] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(like(users.email, `%@${ANONYMOUS_DOMAIN}`));
      const number = (count?.n ?? 0) + 1;
      const label = `Ehemalige Person ${number}`;
      const email = `former-${number}@${ANONYMOUS_DOMAIN}`;
      await tx
        .update(users)
        .set({
          email,
          displayName: label,
          passwordHash: null,
          status: 'deactivated',
          locale: 'de',
          timeZone: 'Europe/Berlin',
          lastLoginAt: null,
          totpSecret: null,
          totpPendingSecret: null,
          totpEnabledAt: null,
          totpLastStep: null,
          feedToken: null,
          directoryId: null,
          externalId: null,
          updatedAt: sql`now()`,
        })
        .where(eq(users.id, id));
      await this.cutAccess(tx, id);
      for (const table of [
        sessions,
        personalAccessTokens,
        oauthGrants,
        userIdentities,
        recoveryCodes,
        groupMembers,
        notificationSettings,
        notifications,
        favourites,
        recentItems,
        userPreferences,
        issueTimers,
        issueWatchers,
        pageWatches,
        dashboardHomes,
        filterSubscriptions,
      ]) {
        await tx.delete(table).where(eq(table.userId, id));
      }
      await tx.delete(invitations).where(eq(invitations.email, user.email));

      // Mentions carry the name as their label; plain text and search follow the documents.
      const pattern = `%${id}%`;
      const issueRows = await tx
        .select({ id: issues.id, doc: issues.description })
        .from(issues)
        .where(sql`${issues.description}::text like ${pattern}`);
      for (const row of issueRows) {
        const doc = relabelMentions(row.doc, id, label);
        if (doc)
          await tx
            .update(issues)
            .set({ description: doc, descriptionText: plainText(doc) })
            .where(eq(issues.id, row.id));
      }
      const commentRows = await tx
        .select({ id: issueComments.id, doc: issueComments.body })
        .from(issueComments)
        .where(sql`${issueComments.body}::text like ${pattern}`);
      for (const row of commentRows) {
        const doc = relabelMentions(row.doc, id, label);
        if (doc)
          await tx
            .update(issueComments)
            .set({ body: doc, bodyText: plainText(doc) })
            .where(eq(issueComments.id, row.id));
      }
      const versionRows = await tx
        .select({ id: pageVersions.id, doc: pageVersions.content })
        .from(pageVersions)
        .where(sql`${pageVersions.content}::text like ${pattern}`);
      for (const row of versionRows) {
        const doc = relabelMentions(row.doc, id, label);
        if (doc)
          await tx
            .update(pageVersions)
            .set({ content: doc, text: plainText(doc) })
            .where(eq(pageVersions.id, row.id));
      }
      const pageCommentRows = await tx
        .select({ id: pageComments.id, doc: pageComments.body })
        .from(pageComments)
        .where(sql`${pageComments.body}::text like ${pattern}`);
      for (const row of pageCommentRows) {
        const doc = relabelMentions(row.doc, id, label);
        if (doc)
          await tx
            .update(pageComments)
            .set({ body: doc, bodyText: plainText(doc) })
            .where(eq(pageComments.id, row.id));
      }
      const templateRows = await tx
        .select({ id: pageTemplates.id, doc: pageTemplates.content })
        .from(pageTemplates)
        .where(sql`${pageTemplates.content}::text like ${pattern}`);
      for (const row of templateRows) {
        const doc = relabelMentions(row.doc, id, label);
        if (doc)
          await tx.update(pageTemplates).set({ content: doc }).where(eq(pageTemplates.id, row.id));
      }

      // The history shows names as they were; for this person, the new one.
      await tx
        .update(issueChangeItems)
        .set({
          fromDisplay: sql`case when ${issueChangeItems.fromValue} = ${id} then ${label} else ${issueChangeItems.fromDisplay} end`,
          toDisplay: sql`case when ${issueChangeItems.toValue} = ${id} then ${label} else ${issueChangeItems.toDisplay} end`,
        })
        .where(or(eq(issueChangeItems.fromValue, id), eq(issueChangeItems.toValue, id)));

      // Copies of the e-mail address (always unique) and, in logs and events, of the name.
      const quoted = (value: string) => JSON.stringify(value);
      const replace = async (table: string, column: string, from: string, to: string) => {
        await tx.execute(sql`
          update ${sql.identifier(table)}
          set ${sql.identifier(column)} = replace(${sql.identifier(column)}::text, ${from}, ${to})::jsonb
          where strpos(${sql.identifier(column)}::text, ${from}) > 0`);
      };
      const jsonColumns = await tx.execute<{ table_name: string; column_name: string }>(sql`
        select c.table_name, c.column_name from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema and t.table_name = c.table_name
        where c.table_schema = current_schema() and c.data_type = 'jsonb'
          and t.table_type = 'BASE TABLE'`);
      for (const column of jsonColumns) {
        await replace(column.table_name, column.column_name, quoted(user.email), quoted(email));
      }
      for (const [table, column] of [
        ['audit_log', 'details'],
        ['domain_events', 'payload'],
        ['webhook_deliveries', 'payload'],
      ] as const) {
        await replace(table, column, quoted(user.displayName), quoted(label));
      }

      // Live drafts change through the collab service, so open editors keep their work.
      const draftRows = await tx
        .select({ name: collabDocuments.name, state: collabDocuments.state })
        .from(collabDocuments)
        .where(sql`position(convert_to(${id}, 'UTF8') in ${collabDocuments.state}) > 0`);
      for (const row of draftRows) {
        const document = new Y.Doc();
        Y.applyUpdate(document, row.state);
        const content = relabelMentions(
          yXmlFragmentToProsemirrorJSON(document.getXmlFragment(DRAFT_FIELD)),
          id,
          label,
        );
        if (content) drafts.push({ name: row.name, content });
      }
      for (const draft of drafts) {
        const writeId = uuidv7();
        await tx.insert(collabWrites).values({
          id: writeId,
          document: draft.name,
          content: draft.content,
          actorName: 'Lenipo',
        });
        await tx.execute(sql`select pg_notify(${DRAFT_WRITE_CHANNEL}, ${writeId})`);
      }
      return label;
    });
    return label;
  }
}
