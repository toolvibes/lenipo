import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import type { AppDependencies } from '../app.module.js';
import { isForeignOrigin } from '../identity/request-guards.js';
import { readCookie, SESSION_COOKIE } from '../identity/secrets.js';
import { SessionService } from '../identity/session.service.js';
import { isValidDocumentName } from './document-name.js';
import { CollabDocumentStore } from './document-store.js';

export interface CollabUser {
  id: string;
  name: string;
}

export interface CollabContext {
  user: CollabUser;
}

export function createCollabServer({ config, database, logger }: AppDependencies) {
  const store = new CollabDocumentStore(database.db);
  const sessions = new SessionService(database, config);
  const log = logger.child({ role: 'collab' });

  return new Server<CollabContext>({
    name: 'tasklore-collab',
    port: config.COLLAB_PORT,
    quiet: true,
    stopOnSignals: false,
    // Persist at most every 2 s while typing, but never later than 10 s after the first change.
    debounce: 2_000,
    maxDebounce: 10_000,

    /** Same session cookie as the REST API; the provider's token is not used. */
    async onAuthenticate({ documentName, requestHeaders }) {
      if (!isValidDocumentName(documentName)) {
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
      // Document-level permissions (wiki spaces, issue security) come with those modules.
      log.debug({ documentName, user: session.userId }, 'Client authenticated');
      return { user: { id: session.userId, name: session.displayName } };
    },

    async onLoadDocument({ document, documentName }) {
      const state = await store.load(documentName);
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
  });
}
