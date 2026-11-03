import type { GenerateIssue } from '../akeneo/types.js';
import type { SourceOption } from '../project/types.js';
import { readSpreadsheet } from './attributes.js';

/**
 * Reads an Akeneo attribute option export (XLSX or CSV) into options per
 * attribute, for sources of L features. Columns, case-insensitive: `attribute`
 * and `code` (required), `label-<locale>`. Other columns are ignored. Rows
 * without attribute or code are skipped, an option listed twice for an
 * attribute keeps the first row. Options stay in file order.
 */
export function parseAkeneoOptionExport(
  bytes: Uint8Array,
  fileName: string,
): { options: Record<string, SourceOption[]>; issues: GenerateIssue[] } {
  const read = readSpreadsheet(bytes, fileName);
  if (!read.ok) return { options: {}, issues: [read.issue] };
  const [header, ...body] = read.rows;
  const columns = (header ?? []).map((h) => h.trim());
  const col = (name: string) => columns.findIndex((c) => c.toLowerCase() === name);
  const attributeCol = col('attribute');
  const codeCol = col('code');
  if (attributeCol < 0 || codeCol < 0) {
    return {
      options: {},
      issues: [{ severity: 'error', message: `${fileName} needs the columns attribute and code, is it an Akeneo attribute option export?` }],
    };
  }
  const labelCols = columns.flatMap((c, i) => (c.toLowerCase().startsWith('label-') ? [{ i, locale: c.slice(6) }] : []));

  const options = new Map<string, Map<string, SourceOption>>();
  let duplicates = 0;
  for (const row of body) {
    const cell = (i: number) => (row[i] ?? '').trim();
    const attribute = cell(attributeCol);
    const code = cell(codeCol);
    if (attribute === '' || code === '') continue;
    const list = options.get(attribute) ?? new Map<string, SourceOption>();
    options.set(attribute, list);
    if (list.has(code)) {
      duplicates++;
      continue;
    }
    const option: SourceOption = { code, labels: {} };
    for (const { i, locale } of labelCols) if (cell(i) !== '') option.labels[locale] = cell(i);
    list.set(code, option);
  }
  const issues: GenerateIssue[] = [];
  if (duplicates > 0) issues.push({ severity: 'warning', message: `${duplicates} rows repeat an option of an attribute, the first row is kept` });
  if (options.size === 0) issues.push({ severity: 'error', message: `${fileName} contains no options` });
  return { options: Object.fromEntries([...options].map(([attribute, list]) => [attribute, [...list.values()]])), issues };
}
