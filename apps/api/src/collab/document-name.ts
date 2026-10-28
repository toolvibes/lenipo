/** Collaborative documents are addressed as `<kind>:<id>`, e.g. `page:3f2a…` or `issue:WEB-12`. */
const DOCUMENT_NAME = /^(page|issue):[A-Za-z0-9_-]{1,64}$/;

export function isValidDocumentName(name: string): boolean {
  return DOCUMENT_NAME.test(name);
}
