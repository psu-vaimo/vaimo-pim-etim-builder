import { ETIM_TABLES, type EtimTableName } from '@akeneo-etim/core';

export type TableMatch =
  | { kind: 'matched'; table: EtimTableName }
  | { kind: 'unknown' }
  | { kind: 'ambiguous'; tables: EtimTableName[] };

/**
 * Finds the ETIM table a file belongs to from its name. Case-insensitive, the
 * extension is ignored and text around the table name is allowed
 * (`2024_ETIMFEATURE_sv.csv`). When one table name is part of another
 * (`ETIMARTCLASS` in `ETIMARTCLASSFEATUREMAP`) the longest wins. A name with
 * two separate table names is ambiguous.
 */
export function matchTableName(fileName: string): TableMatch {
  const base = fileName
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]*$/, '')
    .toUpperCase();
  const found = ETIM_TABLES.filter((t) => base.includes(t));
  // Drop names that only matched as part of a longer matched name.
  const candidates = found.filter((t) => !found.some((other) => other !== t && other.includes(t)));
  const [first, ...rest] = candidates;
  if (first === undefined) return { kind: 'unknown' };
  if (rest.length > 0) return { kind: 'ambiguous', tables: candidates };
  return { kind: 'matched', table: first };
}

export interface FileAssignment<F extends { name: string }> {
  byTable: Partial<Record<EtimTableName, F>>;
  /** Files whose name matches no table, or more than one. */
  unrecognized: F[];
  /** Files for a table that is not needed here, e.g. a map table for a translation. */
  notNeeded: F[];
  /** Earlier files replaced by a later file for the same table. */
  replaced: F[];
}

/**
 * Assigns files to the `allowed` tables. Later files win over earlier ones for the same
 * table, so files can be added in several drops.
 */
export function assignFiles<F extends { name: string }>(
  files: readonly F[],
  allowed: readonly EtimTableName[] = ETIM_TABLES,
): FileAssignment<F> {
  const out: FileAssignment<F> = { byTable: {}, unrecognized: [], notNeeded: [], replaced: [] };
  for (const file of files) {
    const match = matchTableName(file.name);
    if (match.kind !== 'matched') {
      out.unrecognized.push(file);
      continue;
    }
    if (!allowed.includes(match.table)) {
      out.notNeeded.push(file);
      continue;
    }
    const previous = out.byTable[match.table];
    if (previous) out.replaced.push(previous);
    out.byTable[match.table] = file;
  }
  return out;
}

export function missingTables(
  byTable: Partial<Record<EtimTableName, unknown>>,
  required: readonly EtimTableName[],
): EtimTableName[] {
  return required.filter((t) => byTable[t] === undefined);
}
