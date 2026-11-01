/** Collaborative documents are wiki page drafts, addressed as `page:<uuid>` (E-59). */
const DOCUMENT_NAME = /^page:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** The page id of a document name, or null when the name is not a page draft. */
export function pageIdOf(name: string): string | null {
  return DOCUMENT_NAME.exec(name)?.[1] ?? null;
}

/** The Yjs fragment holding a page draft; the editor's Collaboration extension uses it. */
export const DRAFT_FIELD = 'default';

/** The NOTIFY channel that asks the collab service to replace a draft (E-62). */
export const DRAFT_RESET_CHANNEL = 'lenipo_draft_reset';

/** The NOTIFY channel announcing a queued agent change to a draft (E-74). */
export const DRAFT_WRITE_CHANNEL = 'lenipo_draft_write';

/** The collab document name of a page's draft. */
export const draftName = (pageId: string) => `page:${pageId}`;
