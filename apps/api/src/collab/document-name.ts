/** Collaborative documents are wiki page drafts, addressed as `page:<uuid>` (E-59). */
const DOCUMENT_NAME = /^page:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** The page id of a document name, or null when the name is not a page draft. */
export function pageIdOf(name: string): string | null {
  return DOCUMENT_NAME.exec(name)?.[1] ?? null;
}
