import type { EtimRelease, Labels } from '../etim/types.js';
import type { FeatureKey, Project } from '../project/types.js';
import { featureKey } from './features.js';
import type { AkeneoAttribute, AkeneoDependency, DependentAttribute } from './types.js';

/**
 * Generates one attribute dependency per selected class, from the attributes
 * returned by `generateAttributes`:
 * - trigger: class attribute IN [class record code]
 * - every feature attribute of the class, in ETIM order: IS_DISPLAYED
 * - unmapped A features (reference entity) with allowed values: RESTRICTED_VALUES
 *   right after, values as ETIM lists them for the class
 * - label attributes of mapped A features last: IS_DISPLAYED
 */
export function generateDependencies(
  release: EtimRelease,
  project: Project,
  attributes: AkeneoAttribute[],
): AkeneoDependency[] {
  const { codes } = project.settings;
  const byKey = new Map<FeatureKey, AkeneoAttribute[]>();
  for (const a of attributes) {
    if (a.origin.kind !== 'feature') continue;
    const list = byKey.get(a.origin.key) ?? [];
    list.push(a);
    byKey.set(a.origin.key, list);
  }

  const dependencies: AkeneoDependency[] = [];
  for (const classId of project.classIds) {
    const cls = release.classes[classId];
    if (!cls) continue; // reported by generateAttributes
    const recordCode = codes.classRecordPrefix + classId.toLowerCase();
    const shown: DependentAttribute[] = [];
    const labelAttributes: DependentAttribute[] = [];

    for (const cf of cls.features) {
      for (const attr of byKey.get(featureKey(cf.featureId, cf.unitId)) ?? []) {
        if (attr.origin.kind === 'feature' && attr.origin.part === 'label') {
          labelAttributes.push({ attribute_code: attr.code, action: 'IS_DISPLAYED' });
          continue;
        }
        shown.push({ attribute_code: attr.code, action: 'IS_DISPLAYED' });
        if (attr.type === 'akeneo_reference_entity' && cf.valueIds.length > 0) {
          shown.push({
            attribute_code: attr.code,
            action: 'RESTRICTED_VALUES',
            values: cf.valueIds.map((v) => codes.valueRecordPrefix + v.toLowerCase()),
          });
        }
      }
    }

    const labels: Labels = {};
    for (const locale of project.locales) {
      const label = cls.labels[locale];
      if (label) labels[locale] = `${classId} - ${label}`;
    }

    dependencies.push({
      code: codes.dependencyPrefix + recordCode,
      labels,
      isEnabled: true,
      triggeringAttributes: [{ attribute_code: codes.classAttribute, operator: 'IN', values: [recordCode] }],
      dependentAttributes: [...shown, ...labelAttributes],
      origin: { classId },
    });
  }
  return dependencies;
}
