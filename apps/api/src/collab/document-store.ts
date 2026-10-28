import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { collabDocuments } from '../db/schema/index.js';

/** Persists the binary Yjs state of collaborative documents. */
export class CollabDocumentStore {
  constructor(private readonly db: Database) {}

  async load(name: string): Promise<Uint8Array | null> {
    const [row] = await this.db
      .select({ state: collabDocuments.state })
      .from(collabDocuments)
      .where(eq(collabDocuments.name, name));
    return row?.state ?? null;
  }

  async save(name: string, state: Uint8Array): Promise<void> {
    await this.db
      .insert(collabDocuments)
      .values({ name, state })
      .onConflictDoUpdate({
        target: collabDocuments.name,
        set: { state, updatedAt: sql`now()` },
      });
  }
}
