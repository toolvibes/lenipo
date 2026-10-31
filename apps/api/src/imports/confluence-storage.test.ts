import { markdownToDoc } from '@tasklore/editor';
import { describe, expect, it } from 'vitest';
import { storageToMarkdown } from './confluence-storage.js';

const unknown: string[] = [];
const context = {
  spaceKey: 'DOC',
  pageId: (title: string) => (title === 'Betrieb' ? '01a00000-0000-7000-8000-000000000001' : null),
  attachmentId: (name: string) =>
    name === 'plan.png' ? '01a00000-0000-7000-8000-000000000002' : null,
  userName: (key: string) => (key === 'u1' ? 'Lena Vogt' : null),
  unknownMacro: (name: string) => unknown.push(name),
};

describe('Confluence storage format (P-ADM-11)', () => {
  it('converts text, links, mentions, lists and tables', () => {
    const markdown = storageToMarkdown(
      '<h2>Ziel</h2><p>Text mit <strong>fett</strong>, <ac:link><ri:page ri:content-title="Betrieb" /><ac:plain-text-link-body><![CDATA[siehe Betrieb]]></ac:plain-text-link-body></ac:link> und <ac:link><ri:user ri:userkey="u1" /></ac:link>&nbsp;!</p>' +
        '<ul><li>eins<ul><li>zwei</li></ul></li></ul>' +
        '<table><tbody><tr><th>Feld</th><th>Wert</th></tr><tr><td>a</td><td>b</td></tr></tbody></table>',
      context,
    );
    expect(markdown.startsWith('## Ziel\n\nText mit **fett**, ')).toBe(true);
    expect(markdown).toContain(
      '[siehe Betrieb](/spaces/DOC/pages/01a00000-0000-7000-8000-000000000001) und @Lena Vogt',
    );
    expect(markdown).toContain('- eins\n  - zwei');
    expect(markdown).toContain('| Feld | Wert |\n| --- | --- |\n| a | b |');
  });

  it('maps macros onto Tasklore macros and notes unknown ones', () => {
    const markdown = storageToMarkdown(
      '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Wichtig</p></ac:rich-text-body></ac:structured-macro>' +
        '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">java</ac:parameter><ac:plain-text-body><![CDATA[int a = 1;]]></ac:plain-text-body></ac:structured-macro>' +
        '<ac:structured-macro ac:name="expand"><ac:parameter ac:name="title">Mehr</ac:parameter><ac:rich-text-body><p>Details</p></ac:rich-text-body></ac:structured-macro>' +
        '<ac:structured-macro ac:name="toc" />' +
        '<p>Stand: <ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Green</ac:parameter><ac:parameter ac:name="title">Fertig</ac:parameter></ac:structured-macro></p>' +
        '<ac:structured-macro ac:name="jira"><ac:parameter ac:name="key">WEB-1</ac:parameter></ac:structured-macro>' +
        '<ac:image><ri:attachment ri:filename="plan.png" /></ac:image>' +
        '<ac:structured-macro ac:name="gliffy" />',
      context,
    );
    expect(markdown).toContain('> [!NOTE]\n> Wichtig');
    expect(markdown).toContain('```java\nint a = 1;\n```');
    expect(markdown).toContain(':::expand Mehr\nDetails\n:::');
    expect(markdown).toContain('::toc');
    expect(markdown).toContain('Stand: :status[Fertig]{color=green}');
    expect(markdown).toContain(':issue[WEB-1]');
    expect(markdown).toContain('![](attachment:01a00000-0000-7000-8000-000000000002)');
    expect(markdown).toContain('Makro „gliffy“');
    expect(unknown).toEqual(['gliffy']);
    // The result is valid for the editor.
    expect(markdownToDoc(markdown).content?.length).toBeGreaterThan(5);
  });
});
