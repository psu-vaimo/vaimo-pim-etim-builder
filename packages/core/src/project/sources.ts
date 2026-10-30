import { featureKey } from '../akeneo/features.js';
import type { EtimFeatureType } from '../etim/types.js';
import type { FeatureConfig, Project, SourceEntity, SourceMapping, SourceRecord } from './types.js';

const AKENEO_CODE = /^[a-zA-Z0-9_]+$/;
export const AKENEO_CODE_MAX = 100;

/** Problem with an Akeneo code (attribute, rule, record), `undefined` when valid. Empty is invalid. */
export function akeneoCodeError(code: string): string | undefined {
  if (code === '') return 'Code is empty';
  if (!AKENEO_CODE.test(code)) return 'Use only letters, digits and underscores';
  if (code.length > AKENEO_CODE_MAX) return `At most ${AKENEO_CODE_MAX} characters`;
  return undefined;
}

/** Any source-like input, e.g. a UI draft with all fields as strings. */
export interface SourceInput {
  attribute: string;
  second?: string;
  yesValues?: readonly string[];
}

/**
 * Cleans a source list for a feature type: trims codes, drops sources without
 * an attribute, keeps `second` only for R and `yesValues` only for L (trimmed,
 * unique, empty ones dropped). Optional fields are left out when empty.
 */
export function normalizeSources(sources: readonly SourceInput[], type: EtimFeatureType): SourceMapping[] {
  const out: SourceMapping[] = [];
  for (const s of sources) {
    const attribute = s.attribute.trim();
    if (attribute === '') continue;
    const mapping: SourceMapping = { attribute };
    const second = s.second?.trim() ?? '';
    if (type === 'R' && second !== '') mapping.second = second;
    const yes = [...new Set((s.yesValues ?? []).map((v) => v.trim()).filter((v) => v !== ''))];
    if (type === 'L' && yes.length > 0) mapping.yesValues = yes;
    out.push(mapping);
  }
  return out;
}

/** Feature config with `sources` replaced, `sources` is left out when empty. */
export function withSources(config: FeatureConfig | undefined, sources: readonly SourceMapping[]): FeatureConfig {
  const { sources: _old, ...rest } = config ?? {};
  return sources.length === 0 ? rest : { ...rest, sources: [...sources] };
}

/** One ETIM feature (+unit) to customer source attribute pair, e.g. sent to the API. */
export interface FeatureSourceInput extends SourceInput {
  featureId: string;
  unitId?: string;
  /** ETIM type of the feature, decides which of `second` and `yesValues` are kept. */
  type: EtimFeatureType;
}

export type ApplySourcesResult = { ok: true; project: Project } | { ok: false; errors: string[] };

/**
 * Sets the source of each listed feature, replacing what the project had. An
 * empty `attribute` removes the mapping, the feature entry goes when nothing
 * else is left. Ids are upper-cased. Invalid codes and a feature listed twice
 * are errors and nothing is applied.
 */
export function applySourceMappings(project: Project, mappings: readonly FeatureSourceInput[]): ApplySourcesResult {
  const errors: string[] = [];
  const seen = new Set<string>();
  const updates: { key: string; sources: SourceMapping[] }[] = [];
  for (const m of mappings) {
    const key = featureKey(m.featureId.trim().toUpperCase(), m.unitId?.trim().toUpperCase() || undefined);
    if (seen.has(key)) errors.push(`${key}: listed more than once, a feature has at most one source`);
    seen.add(key);
    const sources = normalizeSources([m], m.type);
    for (const s of sources) {
      for (const [field, code] of [['attribute', s.attribute], ['second', s.second]] as const) {
        const error = code === undefined ? undefined : akeneoCodeError(code);
        if (error) errors.push(`${key}: ${field} "${code}": ${error}`);
      }
    }
    updates.push({ key, sources });
  }
  if (errors.length > 0) return { ok: false, errors };

  const features = { ...project.features };
  for (const { key, sources } of updates) {
    const config = withSources(features[key], sources);
    if (Object.keys(config).length === 0) delete features[key];
    else features[key] = config;
  }
  return { ok: true, project: { ...project, features } };
}

/** Project with the records of one reference entity replaced, entities sorted by code, an empty entity is dropped. */
export function withEntityRecords(project: Project, entity: string, records: readonly SourceRecord[]): Project {
  const others = (project.sourceEntities ?? []).filter((e) => e.code !== entity);
  const next: SourceEntity[] = (records.length > 0 ? [...others, { code: entity, records: [...records] }] : others).sort((a, b) =>
    a.code < b.code ? -1 : a.code > b.code ? 1 : 0,
  );
  const { sourceEntities: _old, ...rest } = project;
  return next.length > 0 ? { ...rest, sourceEntities: next } : rest;
}

/** A customer reference entity record to add, e.g. sent to the API. */
export interface SourceRecordInput {
  code: string;
  labels?: Record<string, string>;
}

/**
 * Adds records to a source reference entity, new codes in the given order
 * after the existing ones. A record that exists gets the given labels merged
 * in and keeps its ETIM values. Invalid codes and a code listed twice are
 * errors and nothing is applied.
 */
export function addSourceRecords(project: Project, entity: string, records: readonly SourceRecordInput[]): ApplySourcesResult {
  const errors: string[] = [];
  const entityCode = entity.trim();
  const entityError = akeneoCodeError(entityCode);
  if (entityError) errors.push(`Reference entity "${entityCode}": ${entityError}`);
  const seen = new Set<string>();
  const inputs = records.map((r) => ({ code: r.code.trim(), labels: r.labels ?? {} }));
  for (const { code } of inputs) {
    const error = akeneoCodeError(code);
    if (error) errors.push(`Record "${code}": ${error}`);
    else if (seen.has(code)) errors.push(`Record ${code}: listed more than once`);
    seen.add(code);
  }
  if (errors.length > 0) return { ok: false, errors };

  const current = project.sourceEntities?.find((e) => e.code === entityCode)?.records ?? [];
  const byCode = new Map(inputs.map((r) => [r.code, r]));
  const updated = current.map((r) => {
    const input = byCode.get(r.code);
    return input ? { ...r, labels: { ...r.labels, ...input.labels } } : r;
  });
  const existing = new Set(current.map((r) => r.code));
  const added = inputs.filter((r) => !existing.has(r.code)).map((r) => ({ code: r.code, labels: { ...r.labels }, values: {} }));
  return { ok: true, project: withEntityRecords(project, entityCode, [...updated, ...added]) };
}
