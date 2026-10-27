import { strFromU8, unzipSync } from 'fflate';

/**
 * Minimal XLSX reader: the rows of the first sheet as strings. Reads shared,
 * inline and plain cell values, no formulas or dates. Uses regular
 * expressions instead of a DOM parser, so it also runs in web workers and Node.
 */
export function readXlsxRows(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes);
  const text = (path: string): string | undefined => {
    const file = files[path];
    return file ? strFromU8(file) : undefined;
  };

  const sheetPath = firstSheetPath(text('xl/workbook.xml'), text('xl/_rels/workbook.xml.rels'));
  const sheet = text(sheetPath);
  if (sheet === undefined) throw new Error('The XLSX file has no worksheet');
  const shared = sharedStrings(text('xl/sharedStrings.xml'));

  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: string[] = [];
    let next = 0;
    for (const cell of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1] ?? '';
      const body = cell[2] ?? '';
      const ref = /\br="([A-Z]+)\d*"/.exec(attrs)?.[1];
      const col = ref ? columnIndex(ref) : next;
      next = col + 1;
      const type = /\bt="([^"]*)"/.exec(attrs)?.[1];
      let value: string;
      if (type === 'inlineStr') value = textRuns(body);
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (v === undefined) continue;
        value = type === 's' ? (shared[Number(v)] ?? '') : unescapeXml(v);
      }
      while (row.length < col) row.push('');
      row[col] = value;
    }
    rows.push(row);
  }
  return rows;
}

function firstSheetPath(workbook: string | undefined, rels: string | undefined): string {
  const fallback = 'xl/worksheets/sheet1.xml';
  const id = workbook && /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  if (!id || !rels) return fallback;
  for (const rel of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    if (!rel[0].includes(`Id="${id}"`)) continue;
    const target = /\bTarget="([^"]+)"/.exec(rel[0])?.[1];
    if (!target) return fallback;
    return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  }
  return fallback;
}

function sharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1] ?? ''));
}

/** All `<t>` texts of a string item joined, so rich text runs become one string. Phonetic runs are skipped. */
function textRuns(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  return [...withoutPhonetic.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)].map((m) => unescapeXml(m[1] ?? '')).join('');
}

/** `A` is 0, `Z` 25, `AA` 26. */
function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function unescapeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[e]!;
  });
}
