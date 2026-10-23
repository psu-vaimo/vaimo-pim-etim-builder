import type { EtimFeatureType, EtimRelease } from '../etim/types.js';
import type { AkeneoUnit, FeatureKey, NumericSetup, Project, ProjectSettings, RangeSetup } from '../project/types.js';
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

export function effectiveNumeric(project: Project, key: FeatureKey): NumericSetup {
  return project.features[key]?.numeric ?? project.settings.numeric;
}

export function effectiveRange(project: Project, key: FeatureKey): RangeSetup {
  return project.features[key]?.range ?? project.settings.range;
}

/**
 * True when the feature is meant to become metric attribute(s), so its unit
 * needs a mapping. Features without a unit always use number.
 */
export function resolvesToMetric(feature: ProjectFeature, project: Project): boolean {
  if (!feature.unitId) return false;
  if (feature.type === 'N') return effectiveNumeric(project, feature.key) === 'metric';
  if (feature.type === 'R') return effectiveRange(project, feature.key) === 'minmax-metric';
  return false;
}

/** The Akeneo measurement for an ETIM unit, only when both family and unit are filled in. */
export function unitMapping(settings: ProjectSettings, unitId: string | undefined): AkeneoUnit | undefined {
  const unit = unitId ? settings.unitMap[unitId] : undefined;
  return unit && unit.family.trim() && unit.unit.trim() ? { family: unit.family.trim(), unit: unit.unit.trim() } : undefined;
}
