import {
  collectSourceEntities,
  generateAttributes,
  generateDependencies,
  generateRecords,
  generateRules,
  type AkeneoAttribute,
  type AkeneoDependency,
  type AkeneoRecord,
  type AkeneoRule,
  type EtimRelease,
  type GenerateIssue,
  type Project,
  type SourceEntityPlan,
} from '@akeneo-etim/core';
import { useMemo } from 'react';

export type GeneratedIssue = GenerateIssue & { step: 'attributes' | 'records' | 'rules' };

/** Everything the export generates, without building the files. */
export interface GeneratedModel {
  attributes: AkeneoAttribute[];
  classRecords: AkeneoRecord[];
  valueRecords: AkeneoRecord[];
  rules: AkeneoRule[];
  dependencies: AkeneoDependency[];
  /** Client reference entities that provide A features, with their records. */
  sourceEntities: SourceEntityPlan[];
  /** Attributes, records, rules and source record issues, in that order, like `buildExport`. */
  issues: GeneratedIssue[];
}

/** Runs all generators the way `buildExport` does, rules and dependencies from the generated attributes. */
export function generateModel(release: EtimRelease, project: Project): GeneratedModel {
  const attrs = generateAttributes(release, project);
  const records = generateRecords(release, project);
  const rules = generateRules(release, project, attrs.attributes);
  const dependencies = generateDependencies(release, project, attrs.attributes);
  const sourceEntities = collectSourceEntities(release, project);
  return {
    attributes: attrs.attributes,
    classRecords: records.classes,
    valueRecords: records.values,
    rules: rules.rules,
    dependencies,
    sourceEntities: sourceEntities.entities,
    issues: [
      ...attrs.issues.map((i) => ({ ...i, step: 'attributes' as const })),
      ...records.issues.map((i) => ({ ...i, step: 'records' as const })),
      ...rules.issues.map((i) => ({ ...i, step: 'rules' as const })),
      ...sourceEntities.issues.map((i) => ({ ...i, step: 'records' as const })),
    ],
  };
}

/** Wraps a two argument function so calls with the same arguments (by identity) as the last call reuse its result. */
export function memoizeLast<A extends object, B extends object, R>(fn: (a: A, b: B) => R): (a: A, b: B) => R {
  let last: { a: A; b: B; result: R } | undefined;
  return (a, b) => {
    if (last && last.a === a && last.b === b) return last.result;
    const result = fn(a, b);
    last = { a, b, result };
    return result;
  };
}

/** Shared between steps, so moving from Review to Export does not generate again. */
export const generateModelCached = memoizeLast(generateModel);

/** The generated model for the current release and project, `undefined` without a release. */
export function useGeneratedModel(release: EtimRelease | undefined, project: Project): GeneratedModel | undefined {
  return useMemo(() => (release ? generateModelCached(release, project) : undefined), [release, project]);
}
