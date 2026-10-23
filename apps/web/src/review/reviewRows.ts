import {
  labelFor,
  type AkeneoAttribute,
  type AkeneoAttributeType,
  type AkeneoDependency,
  type AkeneoRecord,
  type AkeneoRule,
  type DependentAttribute,
} from '@akeneo-etim/core';
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
      searchText: searchText([rule.code, rule.origin.key, rule.origin.source, ...Object.values(rule.labels), ...conditions, ...actions]),
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

/** At most `max` items, plus how many were left out. */
export function truncateList<T>(items: readonly T[], max: number): { shown: T[]; more: number } {
  return { shown: items.slice(0, max), more: Math.max(0, items.length - max) };
}
