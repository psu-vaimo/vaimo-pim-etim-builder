import { ETIM_TABLES, type EtimTableName } from './types.js';

export type TableMatch =
  | { kind: 'matched'; table: EtimTableName }
  | { kind: 'unknown' }
  | { kind: 'ambiguous'; tables: EtimTableName[] };

/**
 * Finds the ETIM table a file belongs to from its name. Case-insensitive, the
 * extension is ignored and text around the table name is allowed
 * (`2024_ETIMFEATURE_sv.csv`). The table name must not run on into other
 * letters, so `ETIMARTCLASSSYNONYMMAP` is not `ETIMARTCLASS` and
 * `ETIMFEATUREGROUP` is not `ETIMFEATURE`. A name with two table names is ambiguous.
 */
export function matchTableName(fileName: string): TableMatch {
  const base = baseName(fileName);
  const candidates = ETIM_TABLES.filter((t) => new RegExp(`(?<![A-Z])${t}(?![A-Z])`).test(base));
  const [first, ...rest] = candidates;
  if (first === undefined) return { kind: 'unknown' };
  if (rest.length > 0) return { kind: 'ambiguous', tables: candidates };
  return { kind: 'matched', table: first };
}

function baseName(fileName: string): string {
  return fileName
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]*$/, '')
    .toUpperCase();
}
