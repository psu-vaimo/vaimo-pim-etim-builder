import {
  akeneoCodeError,
  normalizeSources,
  type EtimFeatureType,
  type FeatureConfig,
  type FeatureKey,
  type GenerateIssue,
  type ProjectFeature,
  type SourceMapping,
} from '@akeneo-etim/core';
import type { FeatureRow } from '../features/featureRows.js';

/** A source while it is edited, every field a plain string so inputs stay controlled. */
export interface SourceDraft {
  attribute: string;
  second: string;
  yesValues: string[];
}

export function emptyDraft(): SourceDraft {
  return { attribute: '', second: '', yesValues: [] };
}

export function toDrafts(sources: readonly SourceMapping[] | undefined): SourceDraft[] {
  return (sources ?? []).map((s) => ({ attribute: s.attribute, second: s.second ?? '', yesValues: [...(s.yesValues ?? [])] }));
}

/**
 * True when the drafts, once normalized as on save, differ from the stored
 * sources. Empty rows and whitespace do not count as a change.
 */
export function draftsDiffer(drafts: readonly SourceDraft[], sources: readonly SourceMapping[], type: EtimFeatureType): boolean {
  return JSON.stringify(normalizeSources(drafts, type)) !== JSON.stringify(normalizeSources(sources, type));
}

/** Error for one attribute code, `undefined` when valid. Empty is valid here, callers decide if it is required. */
export function codeError(code: string): string | undefined {
  const c = code.trim();
  return c === '' ? undefined : akeneoCodeError(c);
}

export interface DraftErrors {
  attribute?: string;
  second?: string;
}

/**
 * Inline errors per draft. An empty row is fine (it is dropped on save), a
 * second source without a first one is not. Only one source per feature is
 * allowed, older project files may have more.
 */
export function validateDrafts(drafts: readonly SourceDraft[], type: EtimFeatureType): DraftErrors[] {
  let hasSource = false;
  return drafts.map((d) => {
    const errors: DraftErrors = {};
    const attribute = d.attribute.trim();
    const attributeError = codeError(attribute);
    if (attributeError) errors.attribute = attributeError;
    else if (attribute === '' && type === 'R' && d.second.trim() !== '') errors.attribute = 'Enter the first source too';
    else if (attribute !== '' && hasSource) errors.attribute = 'Only one source per feature, remove this one';
    if (attribute !== '') hasSource = true;
    if (type === 'R') {
      const secondError = codeError(d.second);
      if (secondError) errors.second = secondError;
    }
    return errors;
  });
}

export function hasDraftErrors(errors: readonly DraftErrors[]): boolean {
  return errors.some((e) => e.attribute !== undefined || e.second !== undefined);
}

export { formatAction, formatCondition, ruleConditions } from '@akeneo-etim/core';

/** Short summary of one source for the table, `att_a`, `att_a + att_b`, `att_a (yes: y, ja)`. */
export function formatSource(s: SourceMapping): string {
  let out = s.attribute;
  if (s.second) out += ` + ${s.second}`;
  if (s.yesValues && s.yesValues.length > 0) out += ` (yes: ${s.yesValues.join(', ')})`;
  return out;
}

export function issuesFor(issues: readonly GenerateIssue[], key: FeatureKey): GenerateIssue[] {
  return issues.filter((i) => i.featureKey === key);
}

export interface MappingRow extends FeatureRow {
  /** First selected class using the feature, enough to generate its attributes for the preview. */
  firstClassId: string | undefined;
  sources: SourceMapping[];
}

/** Feature rows with the project's sources, search also matches source codes. */
export function mappingRows(
  rows: readonly FeatureRow[],
  features: readonly ProjectFeature[],
  config: Readonly<Record<FeatureKey, FeatureConfig>>,
): MappingRow[] {
  const byKey = new Map(features.map((f) => [f.key, f]));
  return rows.map((row) => {
    const sources = config[row.key]?.sources ?? [];
    const codes = sources.flatMap((s) => [s.attribute, ...(s.second ? [s.second] : [])]);
    return {
      ...row,
      firstClassId: byKey.get(row.key)?.classIds[0],
      sources,
      searchText: codes.length > 0 ? `${row.searchText}\n${codes.join('\n').toLowerCase()}` : row.searchText,
    };
  });
}

export type MappedFilter = 'all' | 'mapped' | 'unmapped';

export interface MappingFilter {
  search: string;
  type: EtimFeatureType | null;
  mapped: MappedFilter;
}

/** All search words must match the key, a label, an attribute code or a source code. */
export function filterMappingRows(rows: readonly MappingRow[], filter: MappingFilter): MappingRow[] {
  const words = filter.search.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (filter.type !== null && row.type !== filter.type) return false;
    if (filter.mapped === 'mapped' && row.sources.length === 0) return false;
    if (filter.mapped === 'unmapped' && row.sources.length > 0) return false;
    return words.every((w) => row.searchText.includes(w));
  });
}

/** Mapped features in `project.features` that are not used by the selected classes. */
export function orphanMappings(features: readonly ProjectFeature[], config: Readonly<Record<FeatureKey, FeatureConfig>>): FeatureKey[] {
  const used = new Set(features.map((f) => f.key));
  return Object.entries(config)
    .filter(([key, c]) => !used.has(key) && (c.sources?.length ?? 0) > 0)
    .map(([key]) => key)
    .sort();
}

/**
 * Removes the `sources` of the given features, numeric and range overrides
 * stay. Entries left without fields are dropped.
 */
export function withoutSources(
  config: Readonly<Record<FeatureKey, FeatureConfig>>,
  keys: readonly FeatureKey[],
): Record<FeatureKey, FeatureConfig> {
  const remove = new Set(keys);
  const out: Record<FeatureKey, FeatureConfig> = {};
  for (const [key, c] of Object.entries(config)) {
    if (!remove.has(key)) {
      out[key] = c;
      continue;
    }
    const { sources: _sources, ...rest } = c;
    if (Object.keys(rest).length > 0) out[key] = rest;
  }
  return out;
}
