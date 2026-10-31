import { strToU8, zipSync } from 'fflate';

/** A cell: text, a number, a calendar date (`YYYY-MM-DD`) or a point in time, or empty. */
export type Cell = string | number | { date: string } | { dateTime: string } | null;

/**
 * CSV for spreadsheet apps (T-QRY-09, E-111): semicolons and a byte order mark, like the CSV
 * downloads in reports; text that a spreadsheet would run as a formula starts with a quote.
 */
export function toCsv(rows: Cell[][]): string {
  const text = (cell: Cell): string => {
    if (cell === null) return '';
    if (typeof cell === 'number') return String(cell).replace('.', ',');
    if (typeof cell === 'object') return 'date' in cell ? cell.date : cell.dateTime;
    return /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
  };
  const quoted = (cell: Cell) => `"${text(cell).replace(/"/g, '""')}"`;
  return `﻿${rows.map((row) => row.map(quoted).join(';')).join('\r\n')}\r\n`;
}

function escapeXml(text: string): string {
  return (
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      // Control characters are not allowed in XML 1.0.
      // biome-ignore lint/suspicious/noControlCharactersInRegex: removes exactly those
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  );
}

/** Column letters: 0 → A, 26 → AA. */
function column(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

const EPOCH = Date.UTC(1899, 11, 30);

/** Days since 1899-12-30, how spreadsheets store dates. */
function serial(iso: string): number {
  return (Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso) - EPOCH) / 86_400_000;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
</styleSheet>`;

/**
 * A workbook with one sheet, written by hand (E-111): the first row bold and frozen, dates as
 * real dates, text inline so no shared-strings table is needed.
 */
export function toXlsx(rows: Cell[][], sheetName = 'Export'): Uint8Array {
  const cells = rows
    .map((row, r) => {
      const xml = row
        .map((cell, c) => {
          const ref = `${column(c)}${r + 1}`;
          if (cell === null) return '';
          if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`;
          if (typeof cell === 'object') {
            const day = 'date' in cell;
            const value = serial(day ? cell.date : cell.dateTime);
            return `<c r="${ref}" s="${day ? 2 : 3}"><v>${value}</v></c>`;
          }
          const style = r === 0 ? ' s="1"' : '';
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${xml}</row>`;
    })
    .join('');
  const width = Math.max(1, ...rows.map((row) => row.length));
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="2" width="48" customWidth="1"/>${width > 2 ? `<col min="3" max="${width}" width="18" customWidth="1"/>` : ''}</cols>
<sheetData>${cells}</sheetData>
</worksheet>`;
  const name = escapeXml(sheetName.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31));
  return zipSync({
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  });
}
