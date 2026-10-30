import type { EtimRelease } from '../etim/types.js';
import type { Project, SourceRecord } from '../project/types.js';

/** Record attribute on a source reference entity holding the ETIM value code for a feature, `ref_ef000139`. */
export function sourceRecordAttribute(project: Project, featureId: string): string {
  return project.settings.codes.sourceRecordAttributePrefix + featureId.toLowerCase();
}

/** Record attribute holding the ETIM value for a feature in one class, `ref_ef000012_ec002910`. */
export function classRecordAttribute(project: Project, featureId: string, classId: string): string {
  return `${sourceRecordAttribute(project, featureId)}_${classId.toLowerCase()}`;
}

/**
 * Reference entity a source attribute links to: the project link, else the
 * `reference_data_name` from the uploaded Akeneo attribute export.
 */
export function sourceEntityFor(project: Project, attribute: string): string | undefined {
  const linked = project.sourceEntityLinks?.[attribute];
  if (linked) return linked;
  return project.sourceAttributes?.find((a) => a.code === attribute)?.referenceDataName || undefined;
}

/** The ETIM value of a record for a feature in a class: the class exception, else the default. */
export function recordValue(record: SourceRecord, featureId: string, classId?: string): string | undefined {
  return (classId !== undefined ? record.classValues?.[classId]?.[featureId] : undefined) ?? record.values[featureId];
}

/** Selected classes using a feature, in project order. */
export function featureClassIds(release: EtimRelease, project: Project, featureId: string): string[] {
  return project.classIds.filter((c) => release.classes[c]?.features.some((f) => f.featureId === featureId));
}

/**
 * Classes with a record exception for a feature, sorted: a class value on any
 * record of the entity, for a selected class using the feature. Each needs its
 * own record attribute pair and rule.
 */
export function exceptionClassIds(records: readonly SourceRecord[], featureId: string, classIds: readonly string[]): string[] {
  const found = new Set<string>();
  for (const r of records) {
    for (const [classId, values] of Object.entries(r.classValues ?? {})) if (values[featureId]) found.add(classId);
  }
  return classIds.filter((c) => found.has(c)).sort();
}
