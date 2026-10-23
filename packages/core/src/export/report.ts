import type { ProjectFeature } from '../akeneo/features.js';
import type { AkeneoAttribute, AkeneoDependency, AkeneoRule, GenerateIssue } from '../akeneo/types.js';
import { labelFor } from '../etim/labels.js';
import type { EtimRelease } from '../etim/types.js';
import type { Project } from '../project/types.js';
import type { Table } from './table.js';

export interface ReportInput {
  release: EtimRelease;
  project: Project;
  features: ProjectFeature[];
  attributes: AkeneoAttribute[];
  rules: AkeneoRule[];
  dependencies: AkeneoDependency[];
  issues: (GenerateIssue & { step: string })[];
  manualSteps: string[];
}

/** Sheets of the mapping report for customer review. */
export function reportTables(input: ReportInput): Table[] {
  const { release, project, features, attributes, rules, dependencies, issues } = input;
  const locale = project.locales[0];
  const attrsByKey = new Map<string, AkeneoAttribute[]>();
  for (const a of attributes) {
    if (a.origin.kind !== 'feature') continue;
    attrsByKey.set(a.origin.key, [...(attrsByKey.get(a.origin.key) ?? []), a]);
  }
  const rulesByKey = new Map<string, AkeneoRule[]>();
  for (const r of rules) rulesByKey.set(r.origin.key, [...(rulesByKey.get(r.origin.key) ?? []), r]);
  const mapped = features.filter((f) => (project.features[f.key]?.sources ?? []).length > 0).length;

  const summary: Table = {
    name: 'Summary',
    rows: [
      ['Item', 'Value'],
      ['Project', project.name],
      ['Locales', project.locales.join(', ')],
      ['ETIM classes', project.classIds.length],
      ['Features', features.length],
      ['Mapped features', mapped],
      ['Attributes', attributes.length],
      ['Rules', rules.length],
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
      ['Feature', 'Label', 'ETIM type', 'Unit', 'Classes', 'Akeneo attributes', 'Akeneo types', 'Sources (preferred first)', 'Second source', 'Yes values', 'Rules'],
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
          sources.map((s) => s.attribute).join(', '),
          sources.map((s) => s.second ?? '').filter(Boolean).join(', '),
          sources.flatMap((s) => s.yesValues ?? []).join(', '),
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

  return [summary, mapping, attributeSheet, classes, issueSheet];
}
