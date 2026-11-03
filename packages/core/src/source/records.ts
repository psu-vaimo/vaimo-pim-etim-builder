import type { GenerateIssue } from '../akeneo/types.js';
import type { SourceRecord } from '../project/types.js';
import { readSpreadsheet } from './attributes.js';

/**
 * Reads an Akeneo record export of a client reference entity (XLSX or CSV).
 * Columns, case-insensitive: `code` (required), `label-<locale>`, and ETIM
 * value columns `<prefix>ef000139` holding a value id like `EV000072`, and
 * class columns `<prefix>ef000139_ec002910`, so a file exported by this app
 * reads back. A class value equal to the default is not an exception and is
 * skipped. Other columns are ignored. Rows without a code are skipped, a code
 * listed twice keeps the first row.
 */
export function parseAkeneoRecordExport(
  bytes: Uint8Array,
  fileName: string,
  prefix: string,
): { records: SourceRecord[]; issues: GenerateIssue[] } {
  const read = readSpreadsheet(bytes, fileName);
  if (!read.ok) return { records: [], issues: [read.issue] };
  const [header, ...body] = read.rows;
  const columns = (header ?? []).map((h) => h.trim());
  const codeCol = columns.findIndex((c) => c.toLowerCase() === 'code');
  if (codeCol < 0) {
    return { records: [], issues: [{ severity: 'error', message: `${fileName} has no code column, is it an Akeneo record export?` }] };
  }
  const labelCols = columns.flatMap((c, i) => (c.toLowerCase().startsWith('label-') ? [{ i, locale: c.slice(6) }] : []));
  const valuePattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(ef\\d+)(?:_(ec\\d+))?$`, 'i');
  const valueCols = columns.flatMap((c, i) => {
    const m = valuePattern.exec(c);
    return m ? [{ i, featureId: m[1]!.toUpperCase(), classId: m[2]?.toUpperCase() }] : [];
  });
  // Defaults first, so class values can be compared with them.
  valueCols.sort((a, b) => Number(a.classId !== undefined) - Number(b.classId !== undefined));

  const issues: GenerateIssue[] = [];
  const byCode = new Map<string, SourceRecord>();
  let duplicates = 0;
  let invalid = 0;
  for (const row of body) {
    const cell = (i: number) => (row[i] ?? '').trim();
    const code = cell(codeCol);
    if (code === '') continue;
    if (byCode.has(code)) {
      duplicates++;
      continue;
    }
    const record: SourceRecord = { code, labels: {}, values: {} };
    for (const { i, locale } of labelCols) if (cell(i) !== '') record.labels[locale] = cell(i);
    let classValues: Record<string, Record<string, string>> = {};
    for (const { i, featureId, classId } of valueCols) {
      const value = cell(i).toUpperCase();
      if (value === '') continue;
      if (!/^EV\d+$/.test(value)) invalid++;
      else if (classId === undefined) record.values[featureId] = value;
      else if (value !== record.values[featureId]) classValues = { ...classValues, [classId]: { ...classValues[classId], [featureId]: value } };
    }
    if (Object.keys(classValues).length > 0) record.classValues = classValues;
    byCode.set(code, record);
  }
  if (duplicates > 0) issues.push({ severity: 'warning', message: `${duplicates} rows repeat a record code, the first row is kept` });
  if (invalid > 0) issues.push({ severity: 'warning', message: `${invalid} ETIM value cells are not value ids like EV000072, skipped` });
  if (byCode.size === 0) issues.push({ severity: 'error', message: `${fileName} contains no records` });
  return { records: [...byCode.values()], issues };
}
