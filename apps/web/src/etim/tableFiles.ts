import { ETIM_TABLES, matchTableName, type EtimTableName } from '@akeneo-etim/core';

export { matchTableName, type TableMatch } from '@akeneo-etim/core';

/** True for ETIM tables this app does not read, like ETIMARTCLASSSYNONYMMAP or ETIMFEATUREGROUP. */
export function isOtherEtimTable(fileName: string): boolean {
  return matchTableName(fileName).kind === 'unknown' && /(?<![A-Z])ETIM[A-Z]+(?![A-Z])/.test(baseName(fileName));
}

function baseName(fileName: string): string {
  return fileName
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]*$/, '')
    .toUpperCase();
}

export interface FileAssignment<F extends { name: string }> {
  byTable: Partial<Record<EtimTableName, F>>;
  /** Files whose name matches no table, or more than one. */
  unrecognized: F[];
  /** Files for a table that is not needed here, e.g. a map table for a translation, or an ETIM table the app does not read. */
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
      (isOtherEtimTable(file.name) ? out.notNeeded : out.unrecognized).push(file);
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
