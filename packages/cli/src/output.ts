export type Format = 'table' | 'json' | 'md';

export function formatOf(value: unknown): Format {
  if (value === undefined) return 'table';
  if (value === 'table' || value === 'json' || value === 'md') return value;
  throw new Error(`Unknown output format "${String(value)}" (table, json or md)`);
}

/**
 * Rows as aligned columns (D-CLI-06, E-117); the last column is cut to the terminal width so
 * one issue stays one line.
 */
export function table(headers: string[], rows: string[][], width = 120): string {
  if (rows.length === 0) return '';
  const all = [headers, ...rows];
  const widths = headers.map((_, column) =>
    Math.max(...all.map((row) => (row[column] ?? '').length)),
  );
  const fixed = widths.slice(0, -1).reduce((sum, value) => sum + value + 2, 0);
  const last = Math.max(10, width - fixed);
  return all
    .map((row) =>
      row
        .map((cell, column) => {
          if (column === row.length - 1)
            return cell.length > last ? `${cell.slice(0, last - 1)}…` : cell;
          return cell.padEnd(widths[column] ?? 0);
        })
        .join('  ')
        .trimEnd(),
    )
    .join('\n');
}

/** The same rows as a Markdown table, e.g. for notes or pull request texts. */
export function markdownTable(headers: string[], rows: string[][]): string {
  const cellText = (cell: string) => cell.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [
    `| ${headers.map(cellText).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cellText).join(' | ')} |`),
  ].join('\n');
}

export function render(
  format: Format,
  headers: string[],
  rows: string[][],
  data: unknown,
  width?: number,
) {
  if (format === 'json') return JSON.stringify(data, null, 2);
  if (format === 'md') return markdownTable(headers, rows);
  return table(headers, rows, width);
}
