import {
  labelFor,
  resolvesToMetric,
  type AkeneoAttribute,
  type AkeneoAttributeType,
  type EtimFeatureType,
  type EtimRelease,
  type FeatureKey,
  type NumericSetup,
  type Project,
  type ProjectFeature,
  type RangeSetup,
} from '@akeneo-etim/core';

/** Short names for Akeneo attribute types in the UI. */
export const ATTRIBUTE_TYPE_LABELS: Record<AkeneoAttributeType, string> = {
  akeneo_reference_entity: 'Reference entity',
  pim_catalog_text: 'Text',
  pim_catalog_number: 'Number',
  pim_catalog_metric: 'Metric',
  pim_catalog_boolean: 'Yes/No',
};

export const ETIM_TYPE_LABELS: Record<EtimFeatureType, string> = {
  A: 'Alphanumeric',
  N: 'Numeric',
  L: 'Logical',
  R: 'Range',
};

export const NUMERIC_LABELS: Record<NumericSetup, string> = {
  number: 'Number',
  metric: 'Metric',
};

export const RANGE_LABELS: Record<RangeSetup, string> = {
  text: 'One text attribute',
  'minmax-number': 'Min and max, number',
  'minmax-metric': 'Min and max, metric',
};

export interface FeatureRow {
  key: FeatureKey;
  featureId: string;
  label: string;
  type: EtimFeatureType;
  unitId: string | undefined;
  unitLabel: string;
  classCount: number;
  attributes: Pick<AkeneoAttribute, 'code' | 'type'>[];
  /** Lower-cased key, labels in all locales and attribute codes, for search. */
  searchText: string;
}

/** Groups attributes by feature key (`origin.key`), the class attribute is left out. */
export function attributesByKey(attributes: readonly AkeneoAttribute[]): Map<FeatureKey, AkeneoAttribute[]> {
  const byKey = new Map<FeatureKey, AkeneoAttribute[]>();
  for (const a of attributes) {
    if (a.origin.kind !== 'feature') continue;
    const list = byKey.get(a.origin.key);
    if (list) list.push(a);
    else byKey.set(a.origin.key, [a]);
  }
  return byKey;
}

export function featureRows(
  release: EtimRelease,
  features: readonly ProjectFeature[],
  attributes: readonly AkeneoAttribute[],
  locale: string | undefined,
): FeatureRow[] {
  const byKey = attributesByKey(attributes);
  return features.map((f) => {
    const featureLabels = release.features[f.featureId]?.labels ?? {};
    const unitLabels = f.unitId ? (release.units[f.unitId]?.labels ?? {}) : {};
    const attrs = (byKey.get(f.key) ?? []).map((a) => ({ code: a.code, type: a.type }));
    return {
      key: f.key,
      featureId: f.featureId,
      label: labelFor(featureLabels, locale),
      type: f.type,
      unitId: f.unitId,
      unitLabel: labelFor(unitLabels, locale),
      classCount: f.classIds.length,
      attributes: attrs,
      searchText: [f.key, ...Object.values(featureLabels), ...Object.values(unitLabels), ...attrs.map((a) => a.code)]
        .join('\n')
        .toLowerCase(),
    };
  });
}

export interface FeatureFilter {
  search: string;
  type: EtimFeatureType | null;
}

/** All search words must match the key, a label in any locale or an attribute code. */
export function filterFeatureRows(rows: readonly FeatureRow[], filter: FeatureFilter): FeatureRow[] {
  const words = filter.search.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (filter.type !== null && row.type !== filter.type) return false;
    return words.every((w) => row.searchText.includes(w));
  });
}

export function countBy<T, K extends string>(items: readonly T[], keyOf: (item: T) => K): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {};
  for (const item of items) {
    const k = keyOf(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export interface MetricUnitRow {
  unitId: string;
  label: string;
  /** Feature keys resolving to metric with this unit. */
  featureKeys: FeatureKey[];
  mapped: boolean;
}

/** Units used by features that resolve to metric, sorted by id. Missing mappings are flagged. */
export function metricUnitRows(
  release: EtimRelease,
  features: readonly ProjectFeature[],
  project: Project,
  locale: string | undefined,
): MetricUnitRow[] {
  const byUnit = new Map<string, FeatureKey[]>();
  for (const f of features) {
    if (!f.unitId || !resolvesToMetric(f, project)) continue;
    const keys = byUnit.get(f.unitId);
    if (keys) keys.push(f.key);
    else byUnit.set(f.unitId, [f.key]);
  }
  return [...byUnit.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([unitId, featureKeys]) => ({
      unitId,
      label: labelFor(release.units[unitId]?.labels ?? {}, locale),
      featureKeys,
      mapped: project.settings.unitMap[unitId] !== undefined,
    }));
}

/** Common Akeneo measurement families and units, offered as suggestions. Free text is allowed. */
export const MEASUREMENT_SUGGESTIONS: Record<string, readonly string[]> = {
  Length: ['MILLIMETER', 'CENTIMETER', 'METER'],
  Weight: ['KILOGRAM', 'GRAM'],
  Temperature: ['CELSIUS'],
  ElectricCurrent: ['AMPERE'],
  Voltage: ['VOLT'],
  Power: ['WATT'],
};

/** ETIM unit symbols (unit labels) to a suggested Akeneo family and unit. */
const SYMBOL_SUGGESTIONS: Record<string, { family: string; unit: string }> = {
  mm: { family: 'Length', unit: 'MILLIMETER' },
  cm: { family: 'Length', unit: 'CENTIMETER' },
  m: { family: 'Length', unit: 'METER' },
  kg: { family: 'Weight', unit: 'KILOGRAM' },
  g: { family: 'Weight', unit: 'GRAM' },
  '°c': { family: 'Temperature', unit: 'CELSIUS' },
  a: { family: 'ElectricCurrent', unit: 'AMPERE' },
  v: { family: 'Voltage', unit: 'VOLT' },
  w: { family: 'Power', unit: 'WATT' },
};

/** Suggested mapping for an ETIM unit, matched on its labels (`mm`, `kg`, `°C`). */
export function suggestUnitMapping(labels: readonly string[]): { family: string; unit: string } | undefined {
  for (const label of labels) {
    const hit = SYMBOL_SUGGESTIONS[label.trim().toLowerCase()];
    if (hit) return hit;
  }
  return undefined;
}

/** Unit codes to suggest for a family, all known units when the family is not a known one. */
export function unitSuggestions(family: string): string[] {
  const known = MEASUREMENT_SUGGESTIONS[family.trim()];
  return known ? [...known] : Object.values(MEASUREMENT_SUGGESTIONS).flat();
}
