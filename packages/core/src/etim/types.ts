/** ETIM feature types: Alphanumeric, Numeric, Logical, Range. */
export type EtimFeatureType = 'A' | 'N' | 'L' | 'R';

export const ETIM_FEATURE_TYPES: readonly EtimFeatureType[] = ['A', 'N', 'L', 'R'];

/** Labels keyed by Akeneo locale code, e.g. `en_US`, `sv_SE`. */
export type Labels = Record<string, string>;

export interface EtimFeature {
  id: string;
  labels: Labels;
}

export interface EtimValue {
  id: string;
  labels: Labels;
}

export interface EtimUnit {
  id: string;
  labels: Labels;
}

export interface EtimGroup {
  id: string;
  labels: Labels;
}

/** One feature as used by one class (a row in ETIMARTCLASSFEATUREMAP). */
export interface EtimClassFeature {
  /** ARTCLASSFEATURENR, unique per class+feature. */
  nr: string;
  featureId: string;
  type: EtimFeatureType;
  unitId?: string;
  sortNr: number;
  /** Allowed values for A features, in ETIM sort order. */
  valueIds: string[];
}

export interface EtimClass {
  id: string;
  groupId: string;
  version: string;
  versionDate?: string;
  labels: Labels;
  /** In ETIM sort order. */
  features: EtimClassFeature[];
}

/** A parsed ETIM export, JSON serializable. */
export interface EtimRelease {
  locales: string[];
  classes: Record<string, EtimClass>;
  features: Record<string, EtimFeature>;
  values: Record<string, EtimValue>;
  units: Record<string, EtimUnit>;
  /** Empty when the export had no ETIMARTGROUP table. */
  groups: Record<string, EtimGroup>;
}

/** The ETIM tables, in display order. ETIMARTGROUP is optional. */
export const ETIM_TABLES = [
  'ETIMARTCLASS',
  'ETIMFEATURE',
  'ETIMVALUE',
  'ETIMUNIT',
  'ETIMARTCLASSFEATUREMAP',
  'ETIMARTCLASSFEATUREVALUEMAP',
  'ETIMARTGROUP',
] as const;

export type EtimTableName = (typeof ETIM_TABLES)[number];

/** Tables a full export must have. */
export const ETIM_REQUIRED_TABLES: readonly EtimTableName[] = ETIM_TABLES.filter((t) => t !== 'ETIMARTGROUP');

/** Tables with descriptions, the only ones read for a translation. */
export const ETIM_LABEL_TABLES: readonly EtimTableName[] = ['ETIMARTCLASS', 'ETIMFEATURE', 'ETIMVALUE', 'ETIMUNIT', 'ETIMARTGROUP'];

/** Raw CSV text per ETIM table. */
export type EtimTables = Partial<Record<EtimTableName, string>>;

export interface ParseIssue {
  severity: 'error' | 'warning';
  table: EtimTableName;
  /** 1-based data row, header excluded. */
  row?: number;
  message: string;
}

export interface ParseResult {
  release: EtimRelease;
  issues: ParseIssue[];
}
