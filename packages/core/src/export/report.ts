import type { ProjectFeature } from '../akeneo/features.js';
import type { AkeneoAttribute, AkeneoDependency, AkeneoRule, GenerateIssue } from '../akeneo/types.js';
import { featureRecordAttributes, isRecordValueAllowed, type SourceEntityPlan } from '../akeneo/sourceEntities.js';
import { formatAction, ruleConditions } from '../akeneo/ruleText.js';
import { classRecordAttribute, sourceEntityFor, sourceRecordAttribute } from '../akeneo/sourceRecords.js';
import { labelFor } from '../etim/labels.js';
import type { EtimRelease } from '../etim/types.js';
import { mappingStatus } from '../project/sources.js';
import type { Project } from '../project/types.js';
import type { Table } from './table.js';

export interface ReportInput {
  release: EtimRelease;
  project: Project;
  features: ProjectFeature[];
  attributes: AkeneoAttribute[];
  rules: AkeneoRule[];
  dependencies: AkeneoDependency[];
  sourceEntities: SourceEntityPlan[];
  issues: (GenerateIssue & { step: string })[];
  manualSteps: string[];
}

/** Sheets of the mapping report for customer review. */
export function reportTables(input: ReportInput): Table[] {
  const { release, project, features, attributes, rules, dependencies, sourceEntities, issues } = input;
  const locale = project.locales[0];
  const attrsByKey = new Map<string, AkeneoAttribute[]>();
  for (const a of attributes) {
    if (a.origin.kind !== 'feature') continue;
    attrsByKey.set(a.origin.key, [...(attrsByKey.get(a.origin.key) ?? []), a]);
  }
  const rulesByKey = new Map<string, AkeneoRule[]>();
  for (const r of rules) for (const key of r.origin.keys) rulesByKey.set(key, [...(rulesByKey.get(key) ?? []), r]);
  const statusOf = (key: string) => mappingStatus(project.features[key]);
  const mapped = features.filter((f) => statusOf(f.key) === 'mapped').length;
  const skipped = features.filter((f) => statusOf(f.key) === 'skipped').length;
  const valueText = (id: string | undefined) => (id ? labelFor(release.values[id]?.labels ?? {}, locale) : '');
  const featureText = (id: string) => labelFor(release.features[id]?.labels ?? {}, locale);
  const plannedByKey = new Map(sourceEntities.flatMap((e) => e.features.map((f) => [f.key, { entity: e.code, feature: f }] as const)));
  const sourceRecords = sourceEntities.reduce((n, e) => n + e.records.length, 0);
  const recordValues = sourceEntities.reduce((n, e) => n + e.records.length * e.features.length, 0);
  const recordValuesMapped = sourceEntities.reduce(
    (n, e) => n + e.records.reduce((m, r) => m + e.features.filter((f) => r.values[f.featureId]).length, 0),
    0,
  );
  const classValueCount = sourceEntities.reduce(
    (n, e) =>
      n + e.records.reduce((m, r) => m + Object.values(r.classValues ?? {}).reduce((k, v) => k + e.features.filter((f) => v[f.featureId]).length, 0), 0),
    0,
  );

  const summary: Table = {
    name: 'Summary',
    rows: [
      ['Item', 'Value'],
      ['Project', project.name],
      ['ETIM release', project.etimSource?.library ?? 'Uploaded files'],
      ['Locales', project.locales.join(', ')],
      ['ETIM classes', project.classIds.length],
      ['Features', features.length],
      ['Mapped features', mapped],
      ['Skipped features (not mapped on purpose)', skipped],
      ['Attributes', attributes.length],
      ['Source reference entities', sourceEntities.length],
      ['Source records', sourceRecords],
      ['Source record values mapped', `${recordValuesMapped} of ${recordValues}`],
      ['Class values', classValueCount],
      ['Rules', rules.length],
      ['Rule priority', `${project.settings.rulePriority}, class rules ${project.settings.rulePriority + 1} (Akeneo runs lower priorities first)`],
      ['Dependencies', dependencies.length],
      ['Errors', issues.filter((i) => i.severity === 'error').length],
      ['Warnings', issues.filter((i) => i.severity === 'warning').length],
      [],
      ['Manual steps in Akeneo', ''],
      ...input.manualSteps.map((s, i) => [`${i + 1}`, s]),
    ],
  };

  const mapping: Table = {
    name: 'Features',
    rows: [
      [
        'Feature',
        'Label',
        'ETIM type',
        'Unit',
        'Classes',
        'Akeneo attributes',
        'Akeneo types',
        'Mapping status',
        'Source',
        'Second source',
        'Yes values',
        'Reference entity',
        'Class values for',
        'Rules',
      ],
      ...features.map((f) => {
        const sources = project.features[f.key]?.sources ?? [];
        const attrs = attrsByKey.get(f.key) ?? [];
        return [
          f.key,
          labelFor(release.features[f.featureId]?.labels ?? {}, locale),
          f.type,
          f.unitId ? labelFor(release.units[f.unitId]?.labels ?? {}, locale) : '',
          f.classIds.join(', '),
          attrs.map((a) => a.code).join(', '),
          attrs.map((a) => a.type).join(', '),
          { mapped: 'Mapped', skipped: 'Skipped', unmapped: 'Not mapped' }[statusOf(f.key)],
          sources.map((s) => s.attribute).join(', '),
          sources.map((s) => s.second ?? '').filter(Boolean).join(', '),
          sources.flatMap((s) => s.yesValues ?? []).join(', '),
          plannedByKey.get(f.key)?.entity,
          plannedByKey.get(f.key)?.feature.exceptionClassIds.join(', '),
          (rulesByKey.get(f.key) ?? []).map((r) => r.code).join(', '),
        ];
      }),
    ],
  };

  const attributeSheet: Table = {
    name: 'Attributes',
    rows: [
      ['Code', 'Type', ...project.locales.map((l) => `Label ${l}`), 'Group', 'Read only', 'Feature', 'Part', 'Metric family', 'Metric unit'],
      ...attributes.map((a) => [
        a.code,
        a.type,
        ...project.locales.map((l) => a.labels[l]),
        a.group,
        a.readOnly ? 'yes' : 'no',
        a.origin.kind === 'feature' ? a.origin.key : 'class',
        a.origin.kind === 'feature' ? a.origin.part : '',
        a.metricFamily,
        a.defaultMetricUnit,
      ]),
    ],
  };

  const classes: Table = {
    name: 'Classes',
    rows: [
      ['Class', ...project.locales.map((l) => `Label ${l}`), 'Group', 'Dependency', 'Shown attributes', 'Restricted attributes'],
      ...dependencies.map((d) => {
        const cls = release.classes[d.origin.classId];
        const shown = d.dependentAttributes.filter((a) => a.action === 'IS_DISPLAYED').map((a) => a.attribute_code);
        const restricted = d.dependentAttributes.filter((a) => a.action === 'RESTRICTED_VALUES').map((a) => a.attribute_code);
        return [
          d.origin.classId,
          ...project.locales.map((l) => cls?.labels[l]),
          cls ? `${cls.groupId} ${labelFor(release.groups[cls.groupId]?.labels ?? {}, locale)}`.trim() : '',
          d.code,
          shown.join(', '),
          restricted.join(', '),
        ];
      }),
    ],
  };

  const issueSheet: Table = {
    name: 'Issues',
    rows: [
      ['Severity', 'Step', 'Feature', 'Class', 'Message'],
      ...issues.map((i) => [i.severity, i.step, i.featureKey, i.classId, i.message]),
    ],
  };

  // One row per source attribute: what it feeds, and for A features the record attributes its reference entity needs.
  const featureById = new Map(features.map((f) => [f.key, f]));
  const known = new Map((project.sourceAttributes ?? []).map((a) => [a.code, a]));
  const bySource = new Map<string, string[]>();
  for (const f of features) {
    const source = project.features[f.key]?.sources?.[0]?.attribute;
    if (source) bySource.set(source, [...(bySource.get(source) ?? []), f.key]);
  }
  const sourceSheet: Table = {
    name: 'Sources',
    rows: [
      ['Source attribute', 'Akeneo type', 'Reference entity', 'Features', 'Record attributes needed', 'Rules'],
      ...[...bySource.keys()].sort().map((source) => {
        const keys = bySource.get(source) ?? [];
        const recordAttributes = keys.flatMap((k) => {
          const f = featureById.get(k);
          if (f?.type !== 'A') return [];
          const planned = sourceEntities.flatMap((e) => e.features).find((p) => p.key === k);
          if (planned) return featureRecordAttributes(project, planned);
          const code = sourceRecordAttribute(project, f.featureId);
          return [code, code + project.settings.codes.labelSuffix];
        });
        const ruleCodes = [...new Set(keys.flatMap((k) => (rulesByKey.get(k) ?? []).filter((r) => r.origin.source === source).map((r) => r.code)))];
        return [source, known.get(source)?.type, sourceEntityFor(project, source), keys.join(', '), recordAttributes.join(', '), ruleCodes.join(', ')];
      }),
    ],
  };

  // One row per record and feature, then a row per class value of that feature, as filled by the 07 record files.
  const recordSheet: Table = {
    name: 'Source records',
    rows: [
      [
        'Reference entity',
        'Record',
        ...project.locales.map((l) => `Label ${l}`),
        'Feature',
        'Feature label',
        'Class',
        'ETIM value',
        'Value label',
        'Record attribute',
        'Status',
      ],
      ...sourceEntities.flatMap((e) =>
        e.records.flatMap((r) =>
          e.features.flatMap((f) => {
            const row = (classId: string | undefined, valueId: string | undefined, status: string) => [
              e.code,
              r.code,
              ...project.locales.map((l) => r.labels[l]),
              f.featureId,
              featureText(f.featureId),
              classId,
              valueId,
              valueText(valueId),
              classId ? classRecordAttribute(project, f.featureId, classId) : sourceRecordAttribute(project, f.featureId),
              status,
            ];
            const valueId = r.values[f.featureId];
            const classRows = Object.entries(r.classValues ?? {})
              .filter(([, values]) => values[f.featureId])
              .sort(([a], [b]) => (a < b ? -1 : 1))
              .map(([classId, values]) => {
                const id = values[f.featureId]!;
                const allowed = f.classValueIds[classId];
                const status = !allowed
                  ? 'Ignored, class not selected or not using the feature'
                  : !isRecordValueAllowed(allowed, id)
                    ? 'Not allowed by ETIM in the class'
                    : 'Class value';
                return row(classId, id, status);
              });
            const status = !valueId ? 'Not mapped' : isRecordValueAllowed(f.valueIds, valueId) ? 'Mapped' : 'Not allowed by ETIM';
            return [row(undefined, valueId, status), ...classRows];
          }),
        ),
      ),
    ],
  };

  const ruleSheet: Table = {
    name: 'Rules',
    rows: [
      ['Code', ...project.locales.map((l) => `Label ${l}`), 'Priority', 'Source', 'Features', 'Conditions', 'Actions'],
      ...rules.map((r) => [
        r.code,
        ...project.locales.map((l) => r.labels[l]),
        r.priority,
        r.origin.source,
        r.origin.keys.join(', '),
        ruleConditions(r).join('; '),
        r.actions.map(formatAction).join('; '),
      ]),
    ],
  };

  return [summary, mapping, sourceSheet, recordSheet, ruleSheet, attributeSheet, classes, issueSheet];
}
