import { stringify } from 'yaml';
import type { AkeneoAttribute, AkeneoDependency, AkeneoRecord, AkeneoRule } from '../akeneo/types.js';
import type { Project } from '../project/types.js';
import { flag, type Table } from './table.js';

/**
 * No anchors or aliases, and YAML 1.1 quoting so strings like `yes`, `no`,
 * `on` are not read as booleans by older parsers.
 */
const YAML_OPTIONS = { lineWidth: 0, aliasDuplicateObjects: false, version: '1.1' } as const;

const labelColumns = (project: Project) => project.locales.map((l) => `label-${l}`);

/** Attribute groups used by the generated attributes, label is the code. */
export function attributeGroupsTable(project: Project, attributes: AkeneoAttribute[]): Table {
  const codes = [...new Set(attributes.map((a) => a.group))];
  return {
    name: 'attribute_groups',
    rows: [['code', ...labelColumns(project)], ...codes.map((code) => [code, ...project.locales.map(() => code)])],
  };
}

/** Attributes in Akeneo's attribute import columns, as in the prototype's `akn_etim_attributes`, plus metric columns. */
export function attributesTable(project: Project, attributes: AkeneoAttribute[]): Table {
  const numeric = (a: AkeneoAttribute) => a.type === 'pim_catalog_number' || a.type === 'pim_catalog_metric';
  return {
    name: 'attributes',
    rows: [
      [
        'code',
        'type',
        ...labelColumns(project),
        'group',
        'is_read_only',
        'reference_data_name',
        'sort_order',
        'decimals_allowed',
        'negative_allowed',
        'metric_family',
        'default_metric_unit',
        'scopable',
        'unique',
        'useable_as_grid_filter',
        'localizable',
        'is_mandatory',
      ],
      ...attributes.map((a) => [
        a.code,
        a.type,
        ...project.locales.map((l) => a.labels[l]),
        a.group,
        flag(a.readOnly),
        a.referenceDataName,
        a.sortOrder,
        numeric(a) ? flag(a.decimalsAllowed) : undefined,
        numeric(a) ? flag(a.negativeAllowed) : undefined,
        a.metricFamily,
        a.defaultMetricUnit,
        0,
        0,
        0,
        0,
        0,
      ]),
    ],
  };
}

/** Reference entity records in Akeneo's record import columns. */
export function recordsTable(project: Project, name: string, records: AkeneoRecord[]): Table {
  return {
    name,
    rows: [
      ['referenceEntityIdentifier', 'code', ...labelColumns(project)],
      ...records.map((r) => [r.entity, r.code, ...project.locales.map((l) => r.labels[l])]),
    ],
  };
}

/**
 * Rules YAML in the prototype's format (`esv_map_akn_rules`), proven on SaaS:
 * AND condition groups, `execution_type: triggered`. Akeneo's on-prem docs
 * show a flat condition list instead, that format is not used here.
 */
export function rulesYaml(rules: AkeneoRule[]): string {
  const doc = {
    rules: Object.fromEntries(
      rules.map((r) => [
        r.code,
        {
          type: 'product',
          priority: r.priority,
          enabled: r.enabled,
          conditions: r.conditions,
          actions: r.actions,
          labels: r.labels,
          triggers: {},
          execution_type: r.executionType,
        },
      ]),
    ),
  };
  return stringify(doc, YAML_OPTIONS);
}

/** One dependency in the prototype's format (`akn_dependencies`). */
function dependencyDoc(d: AkeneoDependency) {
  return {
    code: d.code,
    labels: d.labels,
    is_enabled: d.isEnabled,
    product_selections: [{ property: 'family', operator: 'ALL', values: null }],
    triggering_attributes: d.triggeringAttributes,
    dependent_attributes: d.dependentAttributes,
  };
}

/** Dependencies YAML for the Akeneo dependency import, keyed by code under `dependencies`. */
export function dependenciesYaml(dependencies: AkeneoDependency[]): string {
  return stringify({ dependencies: Object.fromEntries(dependencies.map((d) => [d.code, dependencyDoc(d)])) }, YAML_OPTIONS);
}
