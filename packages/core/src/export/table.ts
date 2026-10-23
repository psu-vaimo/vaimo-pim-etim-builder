export type Cell = string | number | boolean | null | undefined;

/** A sheet or CSV file: the first row is the header. */
export interface Table {
  name: string;
  rows: Cell[][];
}

/** Akeneo import files use `1`/`0` for flags. */
export const flag = (v: boolean | undefined): number | undefined => (v === undefined ? undefined : v ? 1 : 0);

/**
 * CSV in Akeneo's default import format: `;` delimiter, `"` quoting when needed,
 * `\n` line endings, `true`/`false` written as `1`/`0`.
 */
export function toCsv(rows: Cell[][], delimiter = ';'): string {
  const cell = (v: Cell): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
    return /["\r\n]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(delimiter)).join('\n') + '\n';
}
