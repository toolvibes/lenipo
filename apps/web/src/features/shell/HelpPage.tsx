import { docToHtml, markdownToDoc } from '@tasklore/editor';
import { useMemo } from 'react';
import handbook from '../../../../../docs/10-benutzerhandbuch.md?raw';

/** The user handbook from docs/, built into the app (TL-44, E-125). */
export function HelpPage() {
  const html = useMemo(() => docToHtml(markdownToDoc(handbook)), []);
  return (
    <main className="px-6 py-8 sm:px-10">
      <article
        className="tl-prose tl-prose-read tl-lore min-h-0"
        // Rendered by the editor package, which escapes HTML and filters link targets.
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by docToHtml
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
