import { Server } from '@hocuspocus/server';
import { richTextSchema } from '@tasklore/editor';
import { prosemirrorJSONToYDoc, updateYFragment } from '@tiptap/y-tiptap';
import postgres from 'postgres';
import * as Y from 'yjs';
import { AccessService } from '../access/access.service.js';
import type { AppDependencies } from '../app.module.js';
import { isForeignOrigin } from '../identity/request-guards.js';
import { readCookie, SESSION_COOKIE } from '../identity/secrets.js';
import { SessionService } from '../identity/session.service.js';
import { SpaceAccessService } from '../wiki/space-access.service.js';
import { DRAFT_FIELD, DRAFT_RESET_CHANNEL, pageIdOf } from './document-name.js';
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
  const sessions = new SessionService(database, config);
  const spaceAccess = new SpaceAccessService(database, new AccessService(database));
  const log = logger.child({ role: 'collab' });
  let listener: postgres.Sql | undefined;

  const server: Server<CollabContext> = new Server<CollabContext>({
    name: 'tasklore-collab',
    port: config.COLLAB_PORT,
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
      if (!session) {
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

  return server;
}
