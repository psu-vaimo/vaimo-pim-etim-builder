import type { EtimFeatureType, EtimRelease } from '../etim/types.js';
import type { FeatureKey, Project } from '../project/types.js';
import type { GenerateIssue } from './types.js';

/** One feature+unit combination used by the selected classes. */
export interface ProjectFeature {
  key: FeatureKey;
  featureId: string;
  unitId?: string;
  type: EtimFeatureType;
  /** Selected classes using it, in project order. */
  classIds: string[];
}

export function featureKey(featureId: string, unitId?: string): FeatureKey {
  return unitId ? `${featureId}_${unitId}` : featureId;
}

/**
 * Collects the unique feature+unit combinations over the selected classes,
 * sorted by key. A combination used with different ETIM types keeps the first
 * type and gets a warning, since the type is not part of the attribute code.
 */
export function collectProjectFeatures(
  release: EtimRelease,
  project: Project,
): { features: ProjectFeature[]; issues: GenerateIssue[] } {
  const issues: GenerateIssue[] = [];
  const byKey = new Map<FeatureKey, ProjectFeature>();

  for (const classId of project.classIds) {
    const cls = release.classes[classId];
    if (!cls) {
      issues.push({ severity: 'warning', classId, message: `Class ${classId} is not in the ETIM release, skipped` });
      continue;
    }
    for (const cf of cls.features) {
      const key = featureKey(cf.featureId, cf.unitId);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          key,
          featureId: cf.featureId,
          ...(cf.unitId ? { unitId: cf.unitId } : {}),
          type: cf.type,
          classIds: [classId],
        });
        continue;
      }
      if (existing.type !== cf.type) {
        issues.push({
          severity: 'warning',
          featureKey: key,
          classId,
          message: `${key} is type ${cf.type} in ${classId} but ${existing.type} in ${existing.classIds[0]}, using ${existing.type}`,
        });
      }
      if (!existing.classIds.includes(classId)) existing.classIds.push(classId);
    }
  }

  const features = [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { features, issues };
}
