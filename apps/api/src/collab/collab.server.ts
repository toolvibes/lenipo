import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import type { AppDependencies } from '../app.module.js';
import type { AppConfig } from '../core/config.js';
import { isValidDocumentName } from './document-name.js';
import { CollabDocumentStore } from './document-store.js';

export interface CollabUser {
  id: string;
  name: string;
}

export interface CollabContext {
  user: CollabUser;
}

/**
 * Placeholder until the identity module exists: outside production the client's token is
 * taken as its display name; in production every connection is refused.
 */
function authenticate(config: AppConfig, token: string): CollabUser {
  if (config.NODE_ENV === 'production') {
    throw new Error('Collaboration authentication is not implemented yet');
  }
  const name = token.trim().slice(0, 64);
  if (!name) {
    throw new Error('Missing token');
  }
  return { id: `dev:${name}`, name };
}

export function createCollabServer({ config, database, logger }: AppDependencies) {
  const store = new CollabDocumentStore(database.db);
  const log = logger.child({ role: 'collab' });

  return new Server<CollabContext>({
    name: 'tasklore-collab',
    port: config.COLLAB_PORT,
    quiet: true,
    stopOnSignals: false,
    // Persist at most every 2 s while typing, but never later than 10 s after the first change.
    debounce: 2_000,
    maxDebounce: 10_000,

    async onAuthenticate({ token, documentName }) {
      if (!isValidDocumentName(documentName)) {
        throw new Error('Invalid document name');
      }
      const user = authenticate(config, token);
      log.debug({ documentName, user: user.id }, 'Client authenticated');
      return { user };
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
