import { Redis } from '@hocuspocus/extension-redis';
import { Server } from '@hocuspocus/server';
import { replaceSection, richTextSchema } from '@tasklore/editor';
import {
  prosemirrorJSONToYDoc,
  updateYFragment,
  yXmlFragmentToProsemirrorJSON,
} from '@tiptap/y-tiptap';
import { and, eq } from 'drizzle-orm';
import { Redis as IORedis } from 'ioredis';
import postgres from 'postgres';
import * as Y from 'yjs';
import { AccessService } from '../access/access.service.js';
import type { AppDependencies } from '../app.module.js';
import { AuditService } from '../audit/audit.service.js';
import { countConnections } from '../core/metrics.js';
import { collabWrites } from '../db/schema/index.js';
import { isForeignOrigin } from '../identity/request-guards.js';
import { readCookie, SESSION_COOKIE } from '../identity/secrets.js';
import { SecuritySettingsService } from '../identity/security-settings.service.js';
import { SessionService } from '../identity/session.service.js';
import { SpaceAccessService } from '../wiki/space-access.service.js';
import {
  DRAFT_FIELD,
  DRAFT_RESET_CHANNEL,
  DRAFT_WRITE_CHANNEL,
  pageIdOf,
} from './document-name.js';
import { CollabDocumentStore } from './document-store.js';

export { DRAFT_FIELD } from './document-name.js';

export interface CollabUser {
  id: string;
  name: string;
}

export interface CollabContext {
  user: CollabUser;
  /** When the edit permission was last confirmed for this connection. */
  checkedAt: number;
}

/** `recheckMs`: while connected, the edit permission is confirmed again at most this often. */
export function createCollabServer(
  { config, database, logger }: AppDependencies,
  { recheckMs = 30_000 }: { recheckMs?: number } = {},
) {
  const store = new CollabDocumentStore(database.db);
  // The same sign-in rules as the API (TL-18): lifetimes from the security settings.
  const sessions = new SessionService(
    database,
    new SecuritySettingsService(database, config, new AuditService(database)),
  );
  const spaceAccess = new SpaceAccessService(database, new AccessService(database));
  const log = logger.child({ role: 'collab' });
  let listener: postgres.Sql | undefined;

  const server: Server<CollabContext> = new Server<CollabContext>({
    name: 'tasklore-collab',
    port: config.COLLAB_PORT,
    // Several collab instances share updates and presence through Valkey (TL-42, E-123);
    // without it, run one.
    extensions: config.REDIS_URL
      ? [new Redis({ redis: new IORedis(config.REDIS_URL), prefix: 'tasklore:collab' })]
      : [],
    quiet: true,
    stopOnSignals: false,
    // Persist at most every 2 s while typing, but never later than 10 s after the first change.
    debounce: 2_000,
    maxDebounce: 10_000,

    /** Same session cookie as the REST API; the provider's token is not used. */
    async onAuthenticate({ documentName, requestHeaders }) {
      const pageId = pageIdOf(documentName);
      if (!pageId) {
        throw new Error('Invalid document name');
      }
      if (isForeignOrigin(requestHeaders)) {
        throw new Error('Cross-site connection rejected');
      }
      const secret = readCookie(requestHeaders.get('cookie') ?? undefined, SESSION_COOKIE);
      const session = secret ? await sessions.authenticate(secret) : null;
      // A sign-in still waiting for its second factor does not edit pages.
      if (session?.stage !== 'full') {
        throw new Error('Not signed in');
      }
      // Drafts are for editors only; everyone else is rejected, not given read-only (E-59).
      if (!(await spaceAccess.canEditPage(session.userId, pageId))) {
        throw new Error('No permission to edit this page');
      }
      log.debug({ documentName, user: session.userId }, 'Client authenticated');
      return { user: { id: session.userId, name: session.displayName }, checkedAt: Date.now() };
    },

    /** Deleted pages and lost permissions end the connection within `recheckMs`. */
    async beforeHandleMessage({ context, documentName }) {
      if (Date.now() - context.checkedAt < recheckMs) return;
      const pageId = pageIdOf(documentName);
      if (!pageId || !(await spaceAccess.canEditPage(context.user.id, pageId))) {
        log.debug({ documentName, user: context.user.id }, 'Permission gone, closing');
        throw new Error('No permission to edit this page');
      }
      context.checkedAt = Date.now();
    },

    async onLoadDocument({ document, documentName }) {
      let state = await store.load(documentName);
      // A page without a draft yet (published through the API, restored) starts from its
      // published content, built here once instead of by whichever client comes first.
      const pageId = pageIdOf(documentName);
      if (!state && pageId) {
        const content = await store.publishedContent(pageId);
        if (content) {
          const seeded = prosemirrorJSONToYDoc(richTextSchema, content, DRAFT_FIELD);
          state = Y.encodeStateAsUpdate(seeded);
        }
      }
      if (state) {
        Y.applyUpdate(document, state);
      }
      log.debug({ documentName, bytes: state?.byteLength ?? 0 }, 'Document loaded');
      return document;
    },

    async onStoreDocument({ document, documentName }) {
      const state = Y.encodeStateAsUpdate(document);
      await store.save(documentName, state);
      log.debug({ documentName, bytes: state.byteLength }, 'Document stored');
    },

    /** Restored versions replace the draft (E-62); see {@link resetDraft}. */
    async onListen() {
      listener = postgres(config.DATABASE_URL, { max: 1, onnotice: () => {} });
      await listener.listen(DRAFT_RESET_CHANNEL, (documentName) => {
        resetDraft(documentName).catch((error: unknown) =>
          log.error({ err: error, documentName }, 'Could not reset the draft'),
        );
      });
      await listener.listen(DRAFT_WRITE_CHANNEL, (id) => {
        applyWrite(id).catch((error: unknown) =>
          log.error({ err: error, id }, 'Could not apply an agent change'),
        );
      });
    },

    async onDestroy() {
      await listener?.end({ timeout: 5 });
    },
  });

  /**
   * Rewrites the draft to the page's published content in one Yjs transaction: connected
   * editors receive it as an ordinary change, and their older state cannot bring back what
   * was replaced. A draft nobody has open is loaded, changed and stored the same way.
   */
  async function resetDraft(documentName: string): Promise<void> {
    const pageId = pageIdOf(documentName);
    if (!pageId) return;
    const content = await store.publishedContent(pageId);
    if (!content) return;
    const node = richTextSchema.nodeFromJSON(content);
    const connection = await server.hocuspocus.openDirectConnection(documentName);
    try {
      await connection.transact((document) => {
        updateYFragment(document, document.getXmlFragment(DRAFT_FIELD), node, {
          mapping: new Map(),
          isOMark: new Map(),
        });
      });
    } finally {
      await connection.disconnect();
    }
    log.debug({ documentName }, 'Draft reset to the published content');
  }

  /**
   * Applies a queued agent change to a draft (E-74) in one Yjs transaction, like
   * {@link resetDraft}: the whole draft, or one section of what is in the draft right now,
   * so people's changes elsewhere stay. While it arrives, editors see the agent in the
   * presence list for a few seconds.
   */
  async function applyWrite(id: string): Promise<void> {
    const db = database.db;
    // Claimed once, even if several instances hear the notification.
    const [write] = await db
      .update(collabWrites)
      .set({ status: 'working' })
      .where(and(eq(collabWrites.id, id), eq(collabWrites.status, 'pending')))
      .returning();
    if (!write) return;
    let error: string | null = null;
    const connection = await server.hocuspocus.openDirectConnection(write.document);
    try {
      await connection.transact((document) => {
        const fragment = document.getXmlFragment(DRAFT_FIELD);
        let target = write.content as { type: 'doc'; content?: never[] };
        if (write.section !== null) {
          const current = yXmlFragmentToProsemirrorJSON(fragment) as typeof target;
          const result = replaceSection(
            current,
            write.section,
            target,
            write.newHeading ?? undefined,
          );
          if ('error' in result) {
            error = `Section "${write.section}" ${result.error === 'ambiguous' ? 'is not unique' : 'not found'}. Headings: ${result.headings.join(' | ') || 'none'}`;
            return;
          }
          target = result.doc as typeof target;
        }
        updateYFragment(document, fragment, richTextSchema.nodeFromJSON(target), {
          mapping: new Map(),
          isOMark: new Map(),
        });
        const awareness = (document as { awareness?: AgentAwareness }).awareness;
        if (awareness) {
          awareness.setLocalState({ user: { name: write.actorName, color: '#6a45bf' } });
          setTimeout(() => awareness.setLocalState(null), 5_000).unref();
        }
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      await connection.disconnect();
    }
    await db
      .update(collabWrites)
      .set({ status: error ? 'error' : 'done', error })
      .where(eq(collabWrites.id, id));
    log.debug({ id, document: write.document, error }, 'Agent change applied');
  }

  countConnections('collab', () => server.hocuspocus.getConnectionsCount());
  return server;
}

interface AgentAwareness {
  setLocalState(state: Record<string, unknown> | null): void;
}
