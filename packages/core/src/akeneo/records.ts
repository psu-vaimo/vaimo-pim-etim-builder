import type { EtimRelease, Labels } from '../etim/types.js';
import type { Project } from '../project/types.js';
import type { AkeneoRecord, GenerateIssue } from './types.js';

/**
 * Generates the class and value reference entity records: one per selected
 * class, and one per ETIM value allowed for an A feature in a selected class.
 * Values are sorted by id. Missing labels are left out and counted in one
 * warning per entity and locale.
 */
export function generateRecords(
  release: EtimRelease,
  project: Project,
): { classes: AkeneoRecord[]; values: AkeneoRecord[]; issues: GenerateIssue[] } {
  const { codes } = project.settings;
  const issues: GenerateIssue[] = [];
  const missing = new Map<string, number>();

  const labels = (entity: string, source: Labels): Labels => {
    const out: Labels = {};
    for (const locale of project.locales) {
      const label = source[locale];
      if (label) out[locale] = label;
      else missing.set(`${entity}\t${locale}`, (missing.get(`${entity}\t${locale}`) ?? 0) + 1);
    }
    return out;
  };

  const classes: AkeneoRecord[] = [];
  const valueIds = new Set<string>();
  for (const classId of project.classIds) {
    const cls = release.classes[classId];
    if (!cls) continue; // reported by generateAttributes
    classes.push({
      entity: codes.classEntity,
      code: codes.classRecordPrefix + classId.toLowerCase(),
      labels: labels(codes.classEntity, cls.labels),
    });
    for (const f of cls.features) for (const v of f.valueIds) valueIds.add(v);
  }

  const values = [...valueIds].sort().map(
    (id): AkeneoRecord => ({
      entity: codes.valueEntity,
      code: codes.valueRecordPrefix + id.toLowerCase(),
      labels: labels(codes.valueEntity, release.values[id]?.labels ?? {}),
    }),
  );

  for (const [key, count] of missing) {
    const [entity, locale] = key.split('\t');
    issues.push({ severity: 'warning', message: `${count} ${entity} records have no ${locale} label` });
  }
  return { classes, values, issues };
}
