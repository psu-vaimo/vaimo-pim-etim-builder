import {
  featureRecordAttributes,
  isRecordValueSkipped,
  labelFor,
  type AkeneoAttribute,
  type AkeneoAttributeType,
  type AkeneoDependency,
  type AkeneoRecord,
  type AkeneoRule,
  type DependentAttribute,
  type EtimRelease,
  type Project,
  type SourceEntityPlan,
  type SourceRecord,
} from '@vaimo-pim-etim-builder/core';
import { formatAction, ruleConditions } from '../mapping/sourceMappings.js';

/** A row any review table can search. */
export interface Searchable {
  /** Lower-cased text all search words are matched against. */
  searchText: string;
}

const searchText = (parts: readonly (string | undefined)[]) => parts.filter(Boolean).join('\n').toLowerCase();

/** All search words must be found in the row, an empty search matches everything. */
export function filterBySearch<T extends Searchable>(rows: readonly T[], search: string): T[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((row) => words.every((w) => row.searchText.includes(w)));
}

export interface Page<T> {
  rows: T[];
  page: number;
  totalPages: number;
  /** Index of the first row shown, 0 based. */
  start: number;
}

/** One page of rows, the page number is clamped to the available pages. */
export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), page: current, totalPages, start };
}

/** Attribute counts by Akeneo type, in first seen order. */
export function countAttributeTypes(attributes: readonly AkeneoAttribute[]): [AkeneoAttributeType, number][] {
  const counts = new Map<AkeneoAttributeType, number>();
  for (const a of attributes) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  return [...counts];
}

export interface AttributeReviewRow extends Searchable {
  attribute: AkeneoAttribute;
  /** Feature key, or `''` for the class attribute. */
  feature: string;
}

export function attributeReviewRows(attributes: readonly AkeneoAttribute[]): AttributeReviewRow[] {
  return attributes.map((a) => {
    const feature = a.origin.kind === 'feature' ? a.origin.key : '';
    return { attribute: a, feature, searchText: searchText([a.code, a.type, a.group, feature, ...Object.values(a.labels)]) };
  });
}

export interface RuleReviewRow extends Searchable {
  rule: AkeneoRule;
  label: string;
  conditions: string[];
  actions: string[];
}

export function ruleReviewRows(rules: readonly AkeneoRule[], locale: string | undefined): RuleReviewRow[] {
  return rules.map((rule) => {
    const conditions = ruleConditions(rule);
    const actions = rule.actions.map(formatAction);
    return {
      rule,
      label: labelFor(rule.labels, locale),
      conditions,
      actions,
      searchText: searchText([rule.code, ...rule.origin.keys, rule.origin.source, ...Object.values(rule.labels), ...conditions, ...actions]),
    };
  });
}

export interface DependencyReviewRow extends Searchable {
  dependency: AkeneoDependency;
  label: string;
  /** `etim_class IN [ec000009]` */
  trigger: string;
  shown: number;
  restricted: number;
}

export function formatDependent(d: DependentAttribute): string {
  return d.action === 'IS_DISPLAYED' ? `${d.attribute_code} shown` : `${d.attribute_code} restricted to ${d.values.length} values`;
}

export function dependencyReviewRows(dependencies: readonly AkeneoDependency[], locale: string | undefined): DependencyReviewRow[] {
  return dependencies.map((dependency) => {
    const shown = dependency.dependentAttributes.filter((d) => d.action === 'IS_DISPLAYED').length;
    const trigger = dependency.triggeringAttributes.map((t) => `${t.attribute_code} ${t.operator} [${t.values.join(', ')}]`).join(', ');
    return {
      dependency,
      label: labelFor(dependency.labels, locale),
      trigger,
      shown,
      restricted: dependency.dependentAttributes.length - shown,
      searchText: searchText([
        dependency.code,
        dependency.origin.classId,
        ...Object.values(dependency.labels),
        ...dependency.dependentAttributes.map((d) => d.attribute_code),
      ]),
    };
  });
}

export interface RecordReviewRow extends Searchable {
  record: AkeneoRecord;
}

export function recordReviewRows(records: readonly AkeneoRecord[]): RecordReviewRow[] {
  return records.map((record) => ({ record, searchText: searchText([record.code, ...Object.values(record.labels)]) }));
}

/** One feature a client reference entity provides: how many values its records fill and in how many classes they make exceptions. */
export interface SourceEntityFeatureSummary {
  featureId: string;
  label: string;
  /** Default values plus class values. Can be more than the record count when records make class exceptions. */
  filled: number;
  /** Records with a default value, `records` when every record has one. */
  defaults: number;
  /** Records skipped on purpose, no ETIM value. */
  skipped: number;
  /** Distinct classes with a class exception for the feature. */
  exceptionClasses: string[];
}

/** One client reference entity: the client attributes using it, its records and the features it provides. */
export interface SourceEntitySummary {
  code: string;
  /** Client data model attributes using the entity. */
  attributes: string[];
  records: number;
  features: SourceEntityFeatureSummary[];
  /** Text attributes the entity needs in Akeneo, `ref_ef...` and `_label`, class pairs included. */
  recordAttributes: string[];
  /** Label suffix of the project, to show `ref_ef...` and `ref_ef..._label` as one item. */
  labelSuffix: string;
}

export function sourceEntitySummaries(
  release: EtimRelease,
  project: Project,
  plans: readonly SourceEntityPlan[],
  locale: string | undefined,
): SourceEntitySummary[] {
  return plans.map((plan) => ({
    code: plan.code,
    attributes: plan.attributes,
    records: plan.records.length,
    features: plan.features.map((f) => {
      const defaults = plan.records.filter((r) => r.values[f.featureId]).length;
      const classValues = plan.records.reduce(
        (n, r) => n + f.exceptionClassIds.filter((c) => r.classValues?.[c]?.[f.featureId]).length,
        0,
      );
      return {
        featureId: f.featureId,
        label: labelFor(release.features[f.featureId]?.labels ?? {}, locale),
        filled: defaults + classValues,
        defaults,
        skipped: plan.records.filter((r) => !r.values[f.featureId] && isRecordValueSkipped(r, f.featureId)).length,
        exceptionClasses: f.exceptionClassIds,
      };
    }),
    recordAttributes: plan.features.flatMap((f) => featureRecordAttributes(project, f)),
    labelSuffix: project.settings.codes.labelSuffix,
  }));
}

/** The ETIM value of a source record for one feature, `EV000072 - Zinc plated`, with its class exceptions. */
export interface SourceRecordCell {
  featureId: string;
  value: string | undefined;
  /** No value on purpose. */
  skipped: boolean;
  classValues: { classId: string; value: string }[];
}

export interface SourceRecordReviewRow extends Searchable {
  record: SourceRecord;
  label: string;
  /** Same order as the entity's features. */
  cells: SourceRecordCell[];
}

export function sourceRecordReviewRows(release: EtimRelease, plan: SourceEntityPlan, locale: string | undefined): SourceRecordReviewRow[] {
  const valueText = (id: string) => {
    const label = labelFor(release.values[id]?.labels ?? {}, locale);
    return label ? `${id} - ${label}` : id;
  };
  return plan.records.map((record) => {
    const cells = plan.features.map((f): SourceRecordCell => {
      const id = record.values[f.featureId];
      const classValues = Object.entries(record.classValues ?? {})
        .flatMap(([classId, values]) => (values[f.featureId] ? [{ classId, value: valueText(values[f.featureId]!) }] : []))
        .sort((a, b) => (a.classId < b.classId ? -1 : 1));
      return { featureId: f.featureId, value: id ? valueText(id) : undefined, skipped: !id && isRecordValueSkipped(record, f.featureId), classValues };
    });
    return {
      record,
      label: labelFor(record.labels, locale),
      cells,
      searchText: searchText([
        record.code,
        ...Object.values(record.labels),
        ...cells.flatMap((c) => [c.value, ...c.classValues.flatMap((v) => [v.classId, v.value])]),
      ]),
    };
  });
}

/** At most `max` items, plus how many were left out. */
export function truncateList<T>(items: readonly T[], max: number): { shown: T[]; more: number } {
  return { shown: items.slice(0, max), more: Math.max(0, items.length - max) };
}
