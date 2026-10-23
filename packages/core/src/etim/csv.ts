import Papa from 'papaparse';

export type CsvRow = Record<string, string>;

/**
 * Parses CSV text with a header row. Delimiter is detected (`;`, `,` or tab),
 * headers are upper-cased and trimmed, a leading BOM is stripped and empty
 * rows are skipped. Unknown extra columns are kept, callers pick what they need.
 */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const result = Papa.parse<CsvRow>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    delimitersToGuess: [';', ',', '\t'],
    transformHeader: (h) => h.trim().toUpperCase(),
    transform: (v) => v.trim(),
  });
  return { headers: result.meta.fields ?? [], rows: result.data };
}
