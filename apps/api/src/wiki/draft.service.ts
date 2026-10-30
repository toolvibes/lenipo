import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isValidDoc } from '@tasklore/editor';
import type { RichText } from '@tasklore/shared';
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import { eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import * as Y from 'yjs';
import { DRAFT_FIELD, DRAFT_WRITE_CHANNEL, draftName } from '../collab/document-name.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { collabDocuments, collabWrites, users } from '../db/schema/index.js';
import { PageService } from './page.service.js';

const WAIT_MS = 10_000;

/**
 * The live draft of a page for agents (E-74): read it, and change it through the collab
 * service, so people editing the page at the same time see the change and keep theirs.
 */
@Injectable()
export class DraftService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(PageService) private readonly pages: PageService,
  ) {}

  /** The draft as last stored by the collab service, or null when the page has none yet. */
  async read(principal: Principal, pageId: string): Promise<RichText | null> {
    await this.pages.authorize(principal, pageId, 'edit');
    const [row] = await this.database.db
      .select({ state: collabDocuments.state })
      .from(collabDocuments)
      .where(eq(collabDocuments.name, draftName(pageId)));
    if (!row) return null;
    const doc = new Y.Doc();
    Y.applyUpdate(doc, row.state);
    return yXmlFragmentToProsemirrorJSON(doc.getXmlFragment(DRAFT_FIELD)) as RichText;
  }

  /**
   * Replaces the whole draft, or with `section` the content under that heading, and waits
   * until the collab service applied it.
   */
  async write(
    principal: Principal,
    pageId: string,
    content: RichText,
    options: { section?: string; newHeading?: string } = {},
  ): Promise<void> {
    await this.pages.authorize(principal, pageId, 'edit');
    if (!isValidDoc(content)) throw new BadRequestException('The content is not a valid document');
    const [user] = await this.database.db
      .select({ name: users.displayName })
      .from(users)
      .where(eq(users.id, principal.userId));
    const id = uuidv7();
    await this.database.db.transaction(async (tx) => {
      await tx.insert(collabWrites).values({
        id,
        document: draftName(pageId),
        content,
        section: options.section ?? null,
        newHeading: options.newHeading ?? null,
        actorName: `${user?.name ?? '?'} · Agent`,
      });
      await tx.execute(sql`select pg_notify(${DRAFT_WRITE_CHANNEL}, ${id})`);
    });
    const started = Date.now();
    try {
      while (Date.now() - started < WAIT_MS) {
        const [row] = await this.database.db
          .select({ status: collabWrites.status, error: collabWrites.error })
          .from(collabWrites)
          .where(eq(collabWrites.id, id));
        if (row?.status === 'done') return;
        if (row?.status === 'error')
          throw new BadRequestException(row.error ?? 'The change failed');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new ServiceUnavailableException('The collaboration service did not apply the change');
    } finally {
      await this.database.db.delete(collabWrites).where(eq(collabWrites.id, id));
    }
  }
}
