import { withSources } from '../project/sources.js';
import type { FeatureKey, Project, SourceOption } from '../project/types.js';
import type { EtimRelease } from '../etim/types.js';
import { collectProjectFeatures } from './features.js';

const BOOLEAN_TYPE = 'pim_catalog_boolean';

/** An L feature provided by a source attribute. */
export interface LogicalSourceFeature {
  key: FeatureKey;
  featureId: string;
  unitId?: string;
  /** Source values meaning yes, as stored on the feature's source. */
  yesValues: string[];
}

/** A source value of an L source: a listed option, or a yes value that is not in the list. */
export interface LogicalSourceOption extends SourceOption {
  listed: boolean;
}

/** A client attribute that provides L features. */
export interface LogicalSourcePlan {
  attribute: string;
  /** Akeneo type from the uploaded attribute export. */
  type?: string;
  /**
   * The source is a Yes/No attribute and is copied: its uploaded type is
   * `pim_catalog_boolean`, or nothing says otherwise (no type, no values, no yes values).
   */
  boolean: boolean;
  /** Mapped L features, sorted by key. */
  features: LogicalSourceFeature[];
  /** Listed options in project order, then yes values not listed, sorted. */
  options: LogicalSourceOption[];
}

/**
 * Collects the source attributes behind mapped L features, sorted by code,
 * with their values and the yes values each feature picked from them.
 */
export function collectLogicalSources(release: EtimRelease, project: Project): LogicalSourcePlan[] {
  const plans = new Map<string, LogicalSourcePlan>();
  for (const f of collectProjectFeatures(release, project).features) {
    if (f.type !== 'L') continue;
    const source = project.features[f.key]?.sources?.[0];
    if (!source) continue;
    let plan = plans.get(source.attribute);
    if (!plan) {
      const type = project.sourceAttributes?.find((a) => a.code === source.attribute)?.type || undefined;
      plan = { attribute: source.attribute, ...(type ? { type } : {}), boolean: false, features: [], options: [] };
      plans.set(source.attribute, plan);
    }
    plan.features.push({ key: f.key, featureId: f.featureId, ...(f.unitId ? { unitId: f.unitId } : {}), yesValues: [...(source.yesValues ?? [])] });
  }
  for (const plan of plans.values()) {
    const listed = project.sourceOptions?.[plan.attribute] ?? [];
    const codes = new Set(listed.map((o) => o.code));
    const extra = [...new Set(plan.features.flatMap((f) => f.yesValues))].filter((v) => !codes.has(v)).sort();
    plan.options = [...listed.map((o) => ({ ...o, listed: true })), ...extra.map((code) => ({ code, labels: {}, listed: false }))];
    plan.boolean = plan.type ? plan.type === BOOLEAN_TYPE : plan.options.length === 0;
  }
  return [...plans.values()].sort((a, b) => (a.attribute < b.attribute ? -1 : a.attribute > b.attribute ? 1 : 0));
}

/** L features whose source is not a Yes/No attribute and that have no yes values yet: their rule would copy the source. */
export function featuresWithoutYesValues(plans: readonly LogicalSourcePlan[]): LogicalSourceFeature[] {
  return plans.flatMap((p) => (p.boolean ? [] : p.features.filter((f) => f.yesValues.length === 0)));
}

/** Project with the options of one source attribute replaced, an empty list removes the attribute. */
export function withSourceOptions(project: Project, attribute: string, options: readonly SourceOption[]): Project {
  const { [attribute]: _old, ...others } = project.sourceOptions ?? {};
  const next = options.length > 0 ? { ...others, [attribute]: [...options] } : others;
  const { sourceOptions: _all, ...rest } = project;
  return Object.keys(next).length > 0 ? { ...rest, sourceOptions: next } : rest;
}

/**
 * Project with `value` added to or removed from the yes values of the source
 * of an L feature, yes values kept in the order of the source's options. A
 * feature without a source is left as it is.
 */
export function withYesValue(project: Project, key: FeatureKey, value: string, yes: boolean): Project {
  const config = project.features[key];
  const source = config?.sources?.[0];
  if (!config || !source) return project;
  const current = (source.yesValues ?? []).filter((v) => v !== value);
  const order = (project.sourceOptions?.[source.attribute] ?? []).map((o) => o.code);
  const rank = (v: string) => (order.includes(v) ? order.indexOf(v) : order.length);
  const yesValues = yes ? [...current, value].sort((a, b) => rank(a) - rank(b)) : current;
  const { yesValues: _old, ...rest } = source;
  const next = yesValues.length > 0 ? { ...rest, yesValues } : rest;
  return { ...project, features: { ...project.features, [key]: withSources(config, [next, ...config.sources!.slice(1)]) } };
}

/** Project without one option of a source attribute, also removed from the yes values of the features it provides. */
export function withoutSourceOption(project: Project, attribute: string, code: string): Project {
  const options = (project.sourceOptions?.[attribute] ?? []).filter((o) => o.code !== code);
  let next = withSourceOptions(project, attribute, options);
  for (const [key, config] of Object.entries(project.features)) {
    if (config.sources?.[0]?.attribute === attribute && config.sources[0].yesValues?.includes(code)) next = withYesValue(next, key, code, false);
  }
  return next;
}
