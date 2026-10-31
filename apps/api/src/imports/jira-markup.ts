/**
 * Jira wiki markup (Server/DC) to Markdown for imported descriptions and comments (TL-35,
 * E-118). Covers what people write daily; anything else stays as text.
 */
export function jiraToMarkdown(input: string | null | undefined): string {
  if (!input) return '';
  const blocks: string[] = [];
  // Code and noformat first: their content is not markup.
  let text = input
    .replace(/\r\n/g, '\n')
    .replace(
      /\{(code|noformat)(?::([^}]*))?\}([\s\S]*?)\{\1\}/g,
      (_, kind: string, params: string | undefined, body: string) => {
        const language =
          kind === 'code' ? (params?.split('|')[0]?.match(/^[a-z+#]+$/i)?.[0] ?? '') : '';
        blocks.push(`\`\`\`${language}\n${body.replace(/^\n|\n$/g, '')}\n\`\`\``);
        return `\uE000${blocks.length - 1}\uE000`;
      },
    );
  text = text.replace(/\{quote\}([\s\S]*?)\{quote\}/g, (_, body: string) =>
    body
      .trim()
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n'),
  );
  text = text.replace(/\{panel(?::[^}]*)?\}([\s\S]*?)\{panel\}/g, (_, body: string) =>
    body
      .trim()
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n'),
  );
  text = text.replace(/\{color(?::[^}]*)?\}([\s\S]*?)\{color\}/g, '$1');

  const lines = text.split('\n').map((line) => {
    let row = line;
    const heading = /^h([1-6])\.\s+(.*)$/.exec(row);
    if (heading) return `${'#'.repeat(Number(heading[1]))} ${inline(heading[2] as string)}`;
    if (/^bq\.\s+/.test(row)) return `> ${inline(row.replace(/^bq\.\s+/, ''))}`;
    const list = /^([*#-]+)\s+(.*)$/.exec(row);
    if (list && !/^-{4,}$/.test(row)) {
      const marks = list[1] as string;
      const indent = '  '.repeat(marks.length - 1);
      const ordered = marks.endsWith('#');
      return `${indent}${ordered ? '1.' : '-'} ${inline(list[2] as string)}`;
    }
    if (/^-{4,}\s*$/.test(row)) return '---';
    if (/^\|\|/.test(row)) {
      const cells = row
        .replace(/^\|\||\|\|\s*$/g, '')
        .split('||')
        .map((cell) => inline(cell.trim()));
      return `| ${cells.join(' | ')} |\n| ${cells.map(() => '---').join(' | ')} |`;
    }
    if (/^\|/.test(row)) {
      const cells = row
        .replace(/^\||\|\s*$/g, '')
        .split('|')
        .map((cell) => inline(cell.trim()));
      return `| ${cells.join(' | ')} |`;
    }
    row = inline(row);
    return row;
  });
  return lines
    .join('\n')
    .replace(/\uE000(\d+)\uE000/g, (_, index: string) => blocks[Number(index)] ?? '')
    .trim();
}

function inline(text: string): string {
  return (
    text
      // Links: [text|url], [url], [~user] mentions as plain names.
      .replace(/\[~([^\]]+)\]/g, '@$1')
      .replace(
        /\[([^|\]]+)\|([^\]]+)\]/g,
        (_, label: string, url: string) => `[${label}](${url.trim()})`,
      )
      .replace(/\[((?:https?|mailto):[^\]]+)\]/g, '<$1>')
      // Images and attachments stay readable as their file name.
      .replace(/!([^!\s|]+)(?:\|[^!]*)?!/g, '[Bild: $1]')
      .replace(/\{\{([^}]+)\}\}/g, '`$1`')
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,:;!?]|$)/g, '$1**$2**')
      .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,:;!?]|$)/g, '$1*$2*')
      .replace(/(^|[\s(])-([^-\n]+)-(?=[\s).,:;!?]|$)/g, '$1~~$2~~')
      .replace(/(^|[\s(])\+([^+\n]+)\+(?=[\s).,:;!?]|$)/g, '$1$2')
      .replace(/(^|[\s(])\?\?([^?\n]+)\?\?(?=[\s).,:;!?]|$)/g, '$1*$2*')
  );
}
