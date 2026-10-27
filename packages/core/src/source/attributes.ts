import Papa from 'papaparse';
import type { GenerateIssue } from '../akeneo/types.js';
import { decodeEtimFile } from '../etim/decode.js';
import type { SourceAttribute } from '../project/types.js';
import { readXlsxRows } from './xlsx.js';

/**
 * Reads an Akeneo attribute export (XLSX, or CSV with any common delimiter)
 * into source attributes for mapping. Columns, case-insensitive: `code`
 * (required), `type`, `group`, `reference_data_name` and `label-<locale>`,
 * others are ignored. Rows without a code are skipped, a code listed twice
 * keeps the first row. Sorted by code. Problems are returned as `issues`.
 */
export function parseAkeneoAttributeExport(
  bytes: Uint8Array,
  fileName: string,
): { attributes: SourceAttribute[]; issues: GenerateIssue[] } {
  const issues: GenerateIssue[] = [];
  let rows: string[][];
  try {
    rows = isZip(bytes) ? readXlsxRows(bytes) : csvRows(decodeEtimFile(bytes));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { attributes: [], issues: [{ severity: 'error', message: `${fileName} could not be read: ${reason}` }] };
  }

  const [header, ...body] = rows;
  const columns = (header ?? []).map((h) => h.trim().toLowerCase());
  const col = (name: string) => columns.indexOf(name);
  const codeCol = col('code');
  if (codeCol < 0) {
    return { attributes: [], issues: [{ severity: 'error', message: `${fileName} has no code column, is it an Akeneo attribute export?` }] };
  }
  const typeCol = col('type');
  const groupCol = col('group');
  const refCol = col('reference_data_name');
  const labelCols = columns.flatMap((c, i) => (c.startsWith('label-') ? [{ i, locale: (header?.[i] ?? '').trim().slice(6) }] : []));
  if (typeCol < 0) issues.push({ severity: 'warning', message: `${fileName} has no type column, source types are not checked` });

  const byCode = new Map<string, SourceAttribute>();
  let duplicates = 0;
  for (const row of body) {
    const cell = (i: number) => (i < 0 ? '' : (row[i] ?? '').trim());
    const code = cell(codeCol);
    if (code === '') continue;
    if (byCode.has(code)) {
      duplicates++;
      continue;
    }
    const attr: SourceAttribute = { code, labels: {} };
    for (const { i, locale } of labelCols) if (cell(i) !== '') attr.labels[locale] = cell(i);
    if (cell(typeCol) !== '') attr.type = cell(typeCol);
    if (cell(groupCol) !== '') attr.group = cell(groupCol);
    if (cell(refCol) !== '') attr.referenceDataName = cell(refCol);
    byCode.set(code, attr);
  }
  if (duplicates > 0) issues.push({ severity: 'warning', message: `${duplicates} rows repeat an attribute code, the first row is kept` });
  if (byCode.size === 0) issues.push({ severity: 'error', message: `${fileName} contains no attributes` });

  const attributes = [...byCode.values()].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  return { attributes, issues };
}

function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function csvRows(text: string): string[][] {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy', delimitersToGuess: [';', ',', '\t'] });
  return result.data;
}
