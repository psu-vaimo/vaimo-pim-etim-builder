import { labelFor } from '../etim/labels.js';
import type { EtimRelease } from '../etim/types.js';
import type { Table } from '../export/table.js';
import { withEntityRecords, type ApplySourcesResult } from '../project/sources.js';
import type { FeatureKey, Project, SourceRecord } from '../project/types.js';
import { collectProjectFeatures } from './features.js';
import { sourceRecordAttribute } from './rules.js';
import type { GenerateIssue } from './types.js';

/**
 * Reference entity a source attribute links to: the project link, else the
 * `reference_data_name` from the uploaded Akeneo attribute export.
 */
export function sourceEntityFor(project: Project, attribute: string): string | undefined {
  const linked = project.sourceEntityLinks?.[attribute];
  if (linked) return linked;
  return project.sourceAttributes?.find((a) => a.code === attribute)?.referenceDataName || undefined;
}

/** An A feature filled from a source reference entity. */
export interface SourceEntityFeature {
  key: FeatureKey;
  featureId: string;
  /** The source attribute mapped to the feature. */
  attribute: string;
  /** ETIM values allowed for the feature in the selected classes, in ETIM order, first class first. */
  valueIds: string[];
}

/** A customer reference entity as needed by the mapped A features. */
export interface SourceEntityPlan {
  code: string;
  /** Source attributes linking to it, sorted. */
  attributes: string[];
  /** Mapped A features, sorted by feature id. Each needs the record attributes `ref_ef...` and `ref_ef..._label`. */
  features: SourceEntityFeature[];
  records: SourceRecord[];
}

/**
 * Collects the reference entities behind mapped A features, sorted by code,
 * with the features each must hold ETIM values for and the project's records.
 * Warns about sources without a reference entity, entities without records,
 * unmapped record values and values ETIM does not allow for the feature.
 */
export function collectSourceEntities(release: EtimRelease, project: Project): { entities: SourceEntityPlan[]; issues: GenerateIssue[] } {
  const issues: GenerateIssue[] = [];
  const { features } = collectProjectFeatures(release, project);
  const plans = new Map<string, SourceEntityPlan>();

  for (const f of features) {
    if (f.type !== 'A') continue;
    const attribute = project.features[f.key]?.sources?.[0]?.attribute;
    if (!attribute) continue;
    const code = sourceEntityFor(project, attribute);
    if (!code) {
      issues.push({
        severity: 'warning',
        featureKey: f.key,
        message: `Source ${attribute} of ${f.key} has no reference entity, register it on the mapping to map its records`,
      });
      continue;
    }
    const valueIds = new Set<string>();
    for (const classId of f.classIds) {
      for (const cf of release.classes[classId]?.features ?? []) if (cf.featureId === f.featureId) for (const v of cf.valueIds) valueIds.add(v);
    }
    const plan = plans.get(code) ?? { code, attributes: [], features: [], records: [] };
    if (!plan.attributes.includes(attribute)) plan.attributes.push(attribute);
    plan.features.push({ key: f.key, featureId: f.featureId, attribute, valueIds: [...valueIds] });
    plans.set(code, plan);
  }

  const entities = [...plans.values()].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  for (const plan of entities) {
    plan.attributes.sort();
    plan.features.sort((a, b) => (a.featureId < b.featureId ? -1 : 1));
    plan.records = project.sourceEntities?.find((e) => e.code === plan.code)?.records ?? [];
    if (plan.records.length === 0) {
      issues.push({ severity: 'warning', message: `Reference entity ${plan.code} has no records, add them on the Source records step` });
      continue;
    }
    let unmapped = 0;
    const notAllowed: string[] = [];
    for (const record of plan.records) {
      for (const f of plan.features) {
        const value = record.values[f.featureId];
        if (!value) unmapped++;
        else if (!f.valueIds.includes(value)) notAllowed.push(`${record.code} ${f.featureId}=${value}`);
      }
    }
    if (unmapped > 0) {
      const total = plan.records.length * plan.features.length;
      issues.push({ severity: 'warning', message: `Reference entity ${plan.code}: ${unmapped} of ${total} record values have no ETIM value` });
    }
    if (notAllowed.length > 0) {
      const shown = notAllowed.slice(0, 5).join(', ') + (notAllowed.length > 5 ? ` and ${notAllowed.length - 5} more` : '');
      issues.push({
        severity: 'warning',
        message: `Reference entity ${plan.code}: ${notAllowed.length} values are not allowed by ETIM for the selected classes: ${shown}`,
      });
    }
  }
  return { entities, issues };
}

/**
 * Record import table for one source reference entity: every record with
 * `ref_ef...` (ETIM value code, `EV000072`) and `ref_ef..._label` (value label
 * in the first project locale) per mapped feature, empty when unmapped. Record
 * labels are left out so the import only updates the ETIM attributes.
 */
export function sourceRecordsTable(release: EtimRelease, project: Project, plan: SourceEntityPlan): Table {
  const locale = project.locales[0];
  const suffix = project.settings.codes.labelSuffix;
  const columns = plan.features.flatMap((f) => {
    const code = sourceRecordAttribute(project, f.featureId);
    return [code, code + suffix];
  });
  return {
    name: plan.code,
    rows: [
      ['referenceEntityIdentifier', 'code', ...columns],
      ...plan.records.map((r) => [
        plan.code,
        r.code,
        ...plan.features.flatMap((f) => {
          const value = r.values[f.featureId];
          return value ? [value, labelFor(release.values[value]?.labels ?? {}, locale)] : ['', ''];
        }),
      ]),
    ],
  };
}

/** The ETIM value of one source record for one feature, e.g. sent to the API. An empty `valueId` clears it. */
export interface SourceRecordValueInput {
  entity: string;
  record: string;
  featureId: string;
  valueId: string;
}

/**
 * Sets ETIM values on source records. The entity must be behind an A feature
 * mapped in the project, the feature mapped from a source linking to it, the
 * record must exist and the value must be allowed by ETIM for the feature in
 * the selected classes. Ids are upper-cased. Any error and nothing is applied.
 */
export function applySourceRecordValues(release: EtimRelease, project: Project, values: readonly SourceRecordValueInput[]): ApplySourcesResult {
  const errors: string[] = [];
  const { entities } = collectSourceEntities(release, project);
  const seen = new Set<string>();
  const updates = new Map<string, Map<string, Map<string, string>>>();
  for (const v of values) {
    const entity = v.entity.trim();
    const record = v.record.trim();
    const featureId = v.featureId.trim().toUpperCase();
    const valueId = v.valueId.trim().toUpperCase();
    const where = `${entity} ${record} ${featureId}`;
    const id = `${entity}\n${record}\n${featureId}`;
    if (seen.has(id)) {
      errors.push(`${where}: listed more than once`);
      continue;
    }
    seen.add(id);
    const plan = entities.find((e) => e.code === entity);
    if (!plan) {
      errors.push(`${where}: ${entity} is not the reference entity of a mapped A feature in the selected classes`);
      continue;
    }
    if (!plan.records.some((r) => r.code === record)) errors.push(`${where}: no record ${record} in ${entity}, add it first`);
    const feature = plan.features.find((f) => f.featureId === featureId);
    if (!feature) errors.push(`${where}: ${featureId} is not mapped from a source linking to ${entity}`);
    else if (valueId !== '' && !feature.valueIds.includes(valueId)) {
      errors.push(`${where}: ${valueId} is not allowed by ETIM for ${featureId} in the selected classes`);
    }
    const byRecord = updates.get(entity) ?? new Map<string, Map<string, string>>();
    const byFeature = byRecord.get(record) ?? new Map<string, string>();
    byFeature.set(featureId, valueId);
    byRecord.set(record, byFeature);
    updates.set(entity, byRecord);
  }
  if (errors.length > 0) return { ok: false, errors };

  let next = project;
  for (const [entity, byRecord] of updates) {
    const plan = entities.find((e) => e.code === entity)!;
    const records = plan.records.map((r) => {
      const changes = byRecord.get(r.code);
      if (!changes) return r;
      const recordValues = { ...r.values };
      for (const [featureId, valueId] of changes) {
        if (valueId === '') delete recordValues[featureId];
        else recordValues[featureId] = valueId;
      }
      return { ...r, values: recordValues };
    });
    next = withEntityRecords(next, entity, records);
  }
  return { ok: true, project: next };
}
