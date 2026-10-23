import { parseCsv, type CsvRow } from './csv.js';
import {
  ETIM_FEATURE_TYPES,
  type EtimClass,
  type EtimClassFeature,
  type EtimFeatureType,
  type EtimRelease,
  type EtimTableName,
  type EtimTables,
  type Labels,
  type ParseIssue,
  type ParseResult,
} from './types.js';

const COLUMNS = {
  ETIMARTCLASS: ['ARTCLASSID', 'ARTGROUPID', 'ARTCLASSDESC', 'ARTCLASSVERSION'],
  ETIMFEATURE: ['FEATUREID', 'FEATUREDESC'],
  ETIMVALUE: ['VALUEID', 'VALUEDESC'],
  ETIMUNIT: ['UNITOFMEASID', 'UNITDESC'],
  ETIMARTCLASSFEATUREMAP: ['ARTCLASSFEATURENR', 'ARTCLASSID', 'FEATUREID', 'FEATURETYPE', 'UNITOFMEASID', 'SORTNR'],
  ETIMARTCLASSFEATUREVALUEMAP: ['ARTCLASSFEATURENR', 'VALUEID', 'SORTNR'],
  ETIMARTGROUP: ['ARTGROUPID', 'ARTGROUPDESC'],
} as const satisfies Record<EtimTableName, readonly string[]>;

/** Tables holding descriptions, with their id and description columns. */
const LABEL_TABLES = {
  ETIMARTCLASS: { id: 'ARTCLASSID', desc: 'ARTCLASSDESC', target: 'classes' },
  ETIMFEATURE: { id: 'FEATUREID', desc: 'FEATUREDESC', target: 'features' },
  ETIMVALUE: { id: 'VALUEID', desc: 'VALUEDESC', target: 'values' },
  ETIMUNIT: { id: 'UNITOFMEASID', desc: 'UNITDESC', target: 'units' },
  ETIMARTGROUP: { id: 'ARTGROUPID', desc: 'ARTGROUPDESC', target: 'groups' },
} as const;

type LabelTable = keyof typeof LABEL_TABLES;

class Issues {
  readonly list: ParseIssue[] = [];
  error(table: EtimTableName, message: string, row?: number) {
    this.list.push(row === undefined ? { severity: 'error', table, message } : { severity: 'error', table, row, message });
  }
  warn(table: EtimTableName, message: string, row?: number) {
    this.list.push(row === undefined ? { severity: 'warning', table, message } : { severity: 'warning', table, row, message });
  }
}

/** Reads a table, or returns undefined and records an error when it is missing or lacks columns. */
function readTable(tables: EtimTables, name: EtimTableName, issues: Issues): CsvRow[] | undefined {
  const text = tables[name];
  if (text === undefined) {
    issues.error(name, `Missing table ${name}`);
    return undefined;
  }
  const { headers, rows } = parseCsv(text);
  const missing = COLUMNS[name].filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    issues.error(name, `Missing columns: ${missing.join(', ')}`);
    return undefined;
  }
  return rows;
}

const col = (row: CsvRow, name: string): string => row[name] ?? '';

function toSortNr(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/**
 * Reads id+description rows into `target`, keyed by id. Duplicate ids keep
 * the first row.
 */
function readLabelRows<T extends { id: string; labels: Labels }>(
  rows: CsvRow[],
  name: LabelTable,
  locale: string,
  issues: Issues,
  make: (row: CsvRow, id: string, labels: Labels) => T,
): Record<string, T> {
  const { id: idCol, desc } = LABEL_TABLES[name];
  const out: Record<string, T> = {};
  rows.forEach((row, i) => {
    const id = col(row, idCol);
    if (!id) {
      issues.warn(name, `Empty ${idCol}, row skipped`, i + 1);
      return;
    }
    if (out[id]) {
      issues.warn(name, `Duplicate ${idCol} ${id}, row skipped`, i + 1);
      return;
    }
    out[id] = make(row, id, { [locale]: col(row, desc) });
  });
  return out;
}

/**
 * Parses an ETIM CSV export (the six ETIM tables) in one language.
 * Descriptions become labels for `locale`. Add more languages with
 * {@link mergeEtimTranslations}.
 *
 * Problems are reported as issues, not thrown: rows with broken references
 * are skipped with a warning, a missing table or column is an error.
 */
export function parseEtimExport(tables: EtimTables, locale: string): ParseResult {
  const issues = new Issues();
  const release: EtimRelease = { locales: [locale], classes: {}, features: {}, values: {}, units: {}, groups: {} };

  const featureRows = readTable(tables, 'ETIMFEATURE', issues);
  if (featureRows) {
    release.features = readLabelRows(featureRows, 'ETIMFEATURE', locale, issues, (_, id, labels) => ({ id, labels }));
  }
  const valueRows = readTable(tables, 'ETIMVALUE', issues);
  if (valueRows) {
    release.values = readLabelRows(valueRows, 'ETIMVALUE', locale, issues, (_, id, labels) => ({ id, labels }));
  }
  const unitRows = readTable(tables, 'ETIMUNIT', issues);
  if (unitRows) {
    release.units = readLabelRows(unitRows, 'ETIMUNIT', locale, issues, (_, id, labels) => ({ id, labels }));
  }
  // Optional, only gives group names.
  if (tables.ETIMARTGROUP !== undefined) {
    const groupRows = readTable(tables, 'ETIMARTGROUP', issues);
    if (groupRows) {
      release.groups = readLabelRows(groupRows, 'ETIMARTGROUP', locale, issues, (_, id, labels) => ({ id, labels }));
    }
  }
  const classRows = readTable(tables, 'ETIMARTCLASS', issues);
  if (classRows) {
    release.classes = readLabelRows(classRows, 'ETIMARTCLASS', locale, issues, (row, id, labels): EtimClass => {
      const versionDate = col(row, 'ARTCLASSVERSIONDATE');
      return {
        id,
        groupId: col(row, 'ARTGROUPID'),
        version: col(row, 'ARTCLASSVERSION'),
        ...(versionDate ? { versionDate } : {}),
        labels,
        features: [],
      };
    });
    const hasGroups = Object.keys(release.groups).length > 0;
    const unknownGroups = new Set(
      Object.values(release.classes)
        .map((c) => c.groupId)
        .filter((g) => hasGroups && g && !release.groups[g]),
    );
    if (unknownGroups.size > 0) {
      issues.warn('ETIMARTCLASS', `Unknown groups: ${[...unknownGroups].sort().join(', ')}`);
    }
  }

  const byNr = readClassFeatures(tables, release, issues);
  readClassFeatureValues(tables, release, byNr, issues);

  for (const cls of Object.values(release.classes)) {
    cls.features.sort((a, b) => a.sortNr - b.sortNr);
  }
  return { release, issues: issues.list };
}

function readClassFeatures(
  tables: EtimTables,
  release: EtimRelease,
  issues: Issues,
): Map<string, EtimClassFeature> {
  const name = 'ETIMARTCLASSFEATUREMAP';
  const byNr = new Map<string, EtimClassFeature>();
  const rows = readTable(tables, name, issues);
  if (!rows) return byNr;

  rows.forEach((row, i) => {
    const r = i + 1;
    const nr = col(row, 'ARTCLASSFEATURENR');
    const classId = col(row, 'ARTCLASSID');
    const featureId = col(row, 'FEATUREID');
    const type = col(row, 'FEATURETYPE').toUpperCase();
    const unitId = col(row, 'UNITOFMEASID');

    if (!nr) return issues.warn(name, 'Empty ARTCLASSFEATURENR, row skipped', r);
    if (byNr.has(nr)) return issues.warn(name, `Duplicate ARTCLASSFEATURENR ${nr}, row skipped`, r);
    const cls = release.classes[classId];
    if (!cls) return issues.warn(name, `Unknown class ${classId}, row skipped`, r);
    if (!release.features[featureId]) return issues.warn(name, `Unknown feature ${featureId}, row skipped`, r);
    if (!ETIM_FEATURE_TYPES.includes(type as EtimFeatureType)) {
      return issues.warn(name, `Unknown feature type "${type}" for ${classId}/${featureId}, row skipped`, r);
    }
    if (unitId && !release.units[unitId]) return issues.warn(name, `Unknown unit ${unitId}, row skipped`, r);

    const feature: EtimClassFeature = {
      nr,
      featureId,
      type: type as EtimFeatureType,
      ...(unitId ? { unitId } : {}),
      sortNr: toSortNr(col(row, 'SORTNR')),
      valueIds: [],
    };
    cls.features.push(feature);
    byNr.set(nr, feature);
  });
  return byNr;
}

function readClassFeatureValues(
  tables: EtimTables,
  release: EtimRelease,
  byNr: Map<string, EtimClassFeature>,
  issues: Issues,
): void {
  const name = 'ETIMARTCLASSFEATUREVALUEMAP';
  const rows = readTable(tables, name, issues);
  if (!rows) return;

  const sorted = new Map<EtimClassFeature, { id: string; sortNr: number }[]>();
  rows.forEach((row, i) => {
    const r = i + 1;
    const nr = col(row, 'ARTCLASSFEATURENR');
    const valueId = col(row, 'VALUEID');
    const feature = byNr.get(nr);
    if (!feature) return issues.warn(name, `Unknown ARTCLASSFEATURENR ${nr}, row skipped`, r);
    if (!release.values[valueId]) return issues.warn(name, `Unknown value ${valueId}, row skipped`, r);
    if (feature.type !== 'A') {
      return issues.warn(name, `Value ${valueId} on ${feature.type} feature ${feature.featureId} (nr ${nr}), row skipped`, r);
    }
    const list = sorted.get(feature) ?? [];
    if (list.some((v) => v.id === valueId)) {
      return issues.warn(name, `Duplicate value ${valueId} for nr ${nr}, row skipped`, r);
    }
    list.push({ id: valueId, sortNr: toSortNr(col(row, 'SORTNR')) });
    sorted.set(feature, list);
  });

  for (const [feature, list] of sorted) {
    feature.valueIds = list.sort((a, b) => a.sortNr - b.sortNr).map((v) => v.id);
  }
}

/**
 * Adds labels for `locale` from an ETIM export in another language. Only the
 * description tables (classes, features, values, units) are read, any of them
 * may be left out. Ids not in `release` are ignored and counted in one warning
 * per table. Returns a new release, the input is not changed.
 */
export function mergeEtimTranslations(release: EtimRelease, tables: EtimTables, locale: string): ParseResult {
  const issues = new Issues();
  const next = structuredClone(release);
  if (!next.locales.includes(locale)) next.locales.push(locale);

  for (const name of Object.keys(LABEL_TABLES) as LabelTable[]) {
    if (tables[name] === undefined) continue;
    const rows = readTable(tables, name, issues);
    if (!rows) continue;
    const { id: idCol, desc, target } = LABEL_TABLES[name];
    const items: Record<string, { labels: Labels }> = next[target];
    let unknown = 0;
    for (const row of rows) {
      const item = items[col(row, idCol)];
      if (item) item.labels[locale] = col(row, desc);
      else unknown++;
    }
    if (unknown > 0) issues.warn(name, `${unknown} ids not in the release were ignored`);
  }
  return { release: next, issues: issues.list };
}
