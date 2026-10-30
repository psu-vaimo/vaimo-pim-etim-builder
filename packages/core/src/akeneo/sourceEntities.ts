import { labelFor } from '../etim/labels.js';
import type { EtimRelease } from '../etim/types.js';
import type { Table } from '../export/table.js';
import { withEntityRecords, type ApplySourcesResult } from '../project/sources.js';
import type { FeatureKey, Project, SourceRecord } from '../project/types.js';
import { collectProjectFeatures } from './features.js';
import { classRecordAttribute, exceptionClassIds, featureClassIds, recordValue, sourceEntityFor, sourceRecordAttribute } from './sourceRecords.js';
import type { GenerateIssue } from './types.js';

/** An A feature filled from a source reference entity. */
export interface SourceEntityFeature {
  key: FeatureKey;
  featureId: string;
  /** The source attribute mapped to the feature. */
  attribute: string;
  /** ETIM values allowed for the feature in the selected classes, in ETIM order, first class first. */
  valueIds: string[];
  /** Selected classes using the feature, in project order. */
  classIds: string[];
  /** ETIM values allowed per class, for class exceptions. */
  classValueIds: Record<string, string[]>;
  /** Classes with a record exception, sorted. Each gets the record attributes `ref_ef..._ec...` and its own rule. */
  exceptionClassIds: string[];
}

/** Record attributes a source entity needs for one feature: value code and label, by default and per exception class. */
export function featureRecordAttributes(project: Project, feature: SourceEntityFeature): string[] {
  const suffix = project.settings.codes.labelSuffix;
  return [sourceRecordAttribute(project, feature.featureId), ...feature.exceptionClassIds.map((c) => classRecordAttribute(project, feature.featureId, c))].flatMap(
    (code) => [code, code + suffix],
  );
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
    const classValueIds: Record<string, string[]> = {};
    const classIds = featureClassIds(release, project, f.featureId);
    for (const classId of classIds) {
      const ids = (release.classes[classId]?.features ?? []).filter((cf) => cf.featureId === f.featureId).flatMap((cf) => cf.valueIds);
      classValueIds[classId] = ids;
      for (const v of ids) valueIds.add(v);
    }
    const plan = plans.get(code) ?? { code, attributes: [], features: [], records: [] };
    if (!plan.attributes.includes(attribute)) plan.attributes.push(attribute);
    plan.features.push({ key: f.key, featureId: f.featureId, attribute, valueIds: [...valueIds], classIds, classValueIds, exceptionClassIds: [] });
    plans.set(code, plan);
  }

  const entities = [...plans.values()].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  for (const plan of entities) {
    plan.attributes.sort();
    plan.features.sort((a, b) => (a.featureId < b.featureId ? -1 : 1));
    plan.records = project.sourceEntities?.find((e) => e.code === plan.code)?.records ?? [];
    for (const f of plan.features) f.exceptionClassIds = exceptionClassIds(plan.records, f.featureId, f.classIds);
    if (plan.records.length === 0) {
      issues.push({ severity: 'warning', message: `Reference entity ${plan.code} has no records, add them on the Source records step` });
      continue;
    }
    let unmapped = 0;
    const notAllowed: string[] = [];
    const ignored: string[] = [];
    for (const record of plan.records) {
      for (const f of plan.features) {
        const value = record.values[f.featureId];
        if (!value) unmapped++;
        else if (!f.valueIds.includes(value)) notAllowed.push(`${record.code} ${f.featureId}=${value}`);
        for (const [classId, values] of Object.entries(record.classValues ?? {})) {
          const classValue = values[f.featureId];
          if (!classValue) continue;
          const allowed = f.classValueIds[classId];
          if (!allowed) ignored.push(`${record.code} ${f.featureId} ${classId}`);
          else if (allowed.length > 0 && !allowed.includes(classValue)) notAllowed.push(`${record.code} ${f.featureId}=${classValue} in ${classId}`);
        }
      }
    }
    if (unmapped > 0) {
      const total = plan.records.length * plan.features.length;
      issues.push({ severity: 'warning', message: `Reference entity ${plan.code}: ${unmapped} of ${total} record values have no ETIM value` });
    }
    if (ignored.length > 0) {
      issues.push({
        severity: 'warning',
        message: `Reference entity ${plan.code}: ${ignored.length} class values are for classes that are not selected or do not use the feature, ignored: ${shorten(ignored)}`,
      });
    }
    if (notAllowed.length > 0) {
      issues.push({
        severity: 'warning',
        message: `Reference entity ${plan.code}: ${notAllowed.length} values are not allowed by ETIM for the selected classes: ${shorten(notAllowed)}`,
      });
    }
  }
  return { entities, issues };
}

function shorten(items: readonly string[]): string {
  return items.slice(0, 5).join(', ') + (items.length > 5 ? ` and ${items.length - 5} more` : '');
}

/**
 * Record import table for one source reference entity: every record with
 * `ref_ef...` (ETIM value code, `EV000072`) and `ref_ef..._label` (value label
 * in the first project locale) per mapped feature, empty when unmapped. Record
 * labels are left out so the import only updates the ETIM attributes.
 */
export function sourceRecordsTable(release: EtimRelease, project: Project, plan: SourceEntityPlan): Table {
  const locale = project.locales[0];
  // Per feature the default pair, then a pair per exception class filled with the class value, else the default.
  const columns = plan.features.flatMap((f) => [undefined, ...f.exceptionClassIds].map((classId) => ({ featureId: f.featureId, classId })));
  const cell = (value: string | undefined) => (value ? [value, labelFor(release.values[value]?.labels ?? {}, locale)] : ['', '']);
  return {
    name: plan.code,
    rows: [
      ['referenceEntityIdentifier', 'code', ...plan.features.flatMap((f) => featureRecordAttributes(project, f))],
      ...plan.records.map((r) => [plan.code, r.code, ...columns.flatMap((c) => cell(recordValue(r, c.featureId, c.classId)))]),
    ],
  };
}

/** Record with the value of a feature set, for one class when `classId` is given. An empty `valueId` removes it. */
export function withRecordValue(record: SourceRecord, featureId: string, classId: string | undefined, valueId: string): SourceRecord {
  const set = (values: Record<string, string>): Record<string, string> => {
    const { [featureId]: _old, ...rest } = values;
    return valueId === '' ? rest : { ...rest, [featureId]: valueId };
  };
  if (classId === undefined) return { ...record, values: set(record.values) };
  const { [classId]: current, ...otherClasses } = record.classValues ?? {};
  const classValues = set(current ?? {});
  const next = Object.keys(classValues).length > 0 ? { ...otherClasses, [classId]: classValues } : otherClasses;
  const { classValues: _old, ...rest } = record;
  return Object.keys(next).length > 0 ? { ...rest, classValues: next } : rest;
}

/**
 * The ETIM value of one source record for one feature, e.g. sent to the API.
 * With `classId` it is an exception for that class. An empty `valueId` clears it.
 */
export interface SourceRecordValueInput {
  entity: string;
  record: string;
  featureId: string;
  classId?: string;
  valueId: string;
}

/**
 * Sets ETIM values on source records. The entity must be behind an A feature
 * mapped in the project, the feature mapped from a source linking to it, the
 * record must exist and the value must be allowed by ETIM for the feature in
 * the selected classes, or in the class for a class exception (the class must
 * be selected and use the feature). Ids are upper-cased. Any error and nothing
 * is applied.
 */
export function applySourceRecordValues(release: EtimRelease, project: Project, values: readonly SourceRecordValueInput[]): ApplySourcesResult {
  const errors: string[] = [];
  const { entities } = collectSourceEntities(release, project);
  const seen = new Set<string>();
  const updates: { entity: string; record: string; featureId: string; classId: string | undefined; valueId: string }[] = [];
  for (const v of values) {
    const entity = v.entity.trim();
    const record = v.record.trim();
    const featureId = v.featureId.trim().toUpperCase();
    const classId = v.classId?.trim().toUpperCase() || undefined;
    const valueId = v.valueId.trim().toUpperCase();
    const where = `${entity} ${record} ${featureId}${classId ? ` ${classId}` : ''}`;
    const id = `${entity}\n${record}\n${featureId}\n${classId ?? ''}`;
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
    else if (classId !== undefined && !feature.classIds.includes(classId)) {
      errors.push(`${where}: ${classId} is not a selected class using ${featureId}`);
    } else if (valueId !== '') {
      const allowed = classId === undefined ? feature.valueIds : (feature.classValueIds[classId] ?? []);
      if (!allowed.includes(valueId)) {
        errors.push(`${where}: ${valueId} is not allowed by ETIM for ${featureId} ${classId ? `in ${classId}` : 'in the selected classes'}`);
      }
    }
    updates.push({ entity, record, featureId, classId, valueId });
  }
  if (errors.length > 0) return { ok: false, errors };

  const recordsByEntity = new Map(entities.map((e) => [e.code, e.records]));
  for (const u of updates) {
    const records = recordsByEntity.get(u.entity)!;
    recordsByEntity.set(
      u.entity,
      records.map((r) => (r.code === u.record ? withRecordValue(r, u.featureId, u.classId, u.valueId) : r)),
    );
  }
  let next = project;
  for (const entity of new Set(updates.map((u) => u.entity))) next = withEntityRecords(next, entity, recordsByEntity.get(entity)!);
  return { ok: true, project: next };
}
