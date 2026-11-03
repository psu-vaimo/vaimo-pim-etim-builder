import type { EtimFeatureType, EtimRelease, Labels } from '../etim/types.js';
import type { FeatureKey, Project, SourceAttribute, SourceMapping } from '../project/types.js';
import { defaultSettings } from '../project/defaults.js';
import { akeneoCodeError } from '../project/sources.js';
import { attributeCode } from './attributes.js';
import { classRecordAttribute, exceptionClassIds, featureClassIds, sourceEntityFor, sourceRecordAttribute } from './sourceRecords.js';
import type {
  AkeneoAttribute,
  AkeneoRule,
  CopyAction,
  FeaturePart,
  GenerateIssue,
  RuleAction,
  RuleFieldCondition,
} from './types.js';

const FALLBACK_FROM = defaultSettings().labelTexts.en_US!.from;

/** A mapped feature with its attributes, collected before rules are built. */
interface MappedFeature {
  key: FeatureKey;
  featureId: string;
  type: EtimFeatureType;
  parts: Partial<Record<FeaturePart, AkeneoAttribute>>;
  source: SourceMapping;
}

/**
 * Generates the enrichment rules for mapped features, from the attributes
 * returned by `generateAttributes`. A feature has one source (data model
 * attribute), a source can provide many features.
 *
 * One rule per source, `<rule prefix><source>`, with a copy action per
 * feature the source is mapped to. Conditions: class attribute and source NOT
 * EMPTY. Features that need their own conditions or a second source get their
 * own rule, `<rule prefix><attribute code>`: L with yes values (`_true` and
 * `_false`) and R with a second source. All rules use the project priority.
 *
 * | ETIM | action |
 * |---|---|
 * | A | copy the source record's `ref_ef...` attribute to the feature, `ref_ef..._label` to `<code>_label` |
 * | N | copy |
 * | L | yes values: own rules, set true when IN, set false when NOT IN. No yes values: copy (boolean source) |
 * | R text | copy, or with `second` own rule concatenating as `10-20` |
 * | R min/max | copy to min and max, or with `second` own rule copying `second` to max |
 *
 * A features whose source records have class exceptions get one more rule per
 * source and class, `<rule prefix><source>_<class>`, with the condition
 * `etim_class IN [<class record>]`, copying `ref_ef..._ec...` and its label.
 * It has priority one higher: Akeneo runs lower priorities first, so it runs
 * after the default rule and overwrites it.
 * The record export fills the class attributes of every record, so records
 * without an exception get the default value.
 */
export function generateRules(
  release: EtimRelease,
  project: Project,
  attributes: AkeneoAttribute[],
): { rules: AkeneoRule[]; issues: GenerateIssue[] } {
  const { settings } = project;
  const { codes } = settings;
  const issues: GenerateIssue[] = [];
  const rules: AkeneoRule[] = [];
  const priority = settings.rulePriority;
  const known = new Map((project.sourceAttributes ?? []).map((a) => [a.code, a]));
  const fromWord = (locale: string) => settings.labelTexts[locale]?.from ?? settings.labelTexts.en_US?.from ?? FALLBACK_FROM;

  const byKey = new Map<FeatureKey, Partial<Record<FeaturePart, AkeneoAttribute>>>();
  for (const a of attributes) {
    if (a.origin.kind !== 'feature') continue;
    byKey.set(a.origin.key, { ...byKey.get(a.origin.key), [a.origin.part]: a });
  }

  const mapped: MappedFeature[] = [];
  for (const [key, parts] of byKey) {
    const sources = project.features[key]?.sources ?? [];
    const [source, ...extra] = sources;
    if (!source) continue;
    const valueAttr = parts.value ?? parts.min;
    if (!valueAttr || valueAttr.origin.kind !== 'feature') continue;
    const { featureId, etimType: type } = valueAttr.origin;
    if (extra.length > 0) {
      issues.push({
        severity: 'error',
        featureKey: key,
        message: `${key} has ${sources.length} sources, only one is allowed. Using ${source.attribute}`,
      });
    }
    const second = type === 'R' ? source.second : undefined;
    const bad = [source.attribute, ...(second ? [second] : [])].filter((f) => akeneoCodeError(f) !== undefined);
    if (bad.length > 0) {
      issues.push({ severity: 'error', featureKey: key, message: `Invalid source attribute code "${bad.join('", "')}"` });
      continue;
    }
    if (source.second && type !== 'R') {
      issues.push({ severity: 'warning', featureKey: key, message: `Second source ${source.second} is only used for R features, ignored` });
    }
    if (source.yesValues && type !== 'L') {
      issues.push({ severity: 'warning', featureKey: key, message: `Yes values are only used for L features, ignored` });
    }
    if (known.size > 0) checkKnownSources(key, type, source, second, known, issues);
    mapped.push({ key, featureId, type, parts, source });
  }

  if (priority < 0) {
    issues.push({ severity: 'error', message: `Rule priority ${priority} is negative, raise the project rule priority` });
  }

  const rule = (
    code: string,
    conditions: RuleFieldCondition[],
    actions: RuleAction[],
    labels: Labels,
    origin: AkeneoRule['origin'],
    rulePriority = priority,
  ): AkeneoRule => ({
    code,
    priority: rulePriority,
    enabled: true,
    conditions: [{ operator: 'AND', value: [{ field: codes.classAttribute, operator: 'NOT EMPTY' }, ...conditions] }],
    actions,
    labels,
    executionType: 'triggered',
    origin,
  });
  const copy = (from: string, to: AkeneoAttribute): CopyAction => ({ type: 'copy', from_field: from, to_field: to.code });
  const notEmpty = (...fields: string[]) => fields.map((field): RuleFieldCondition => ({ field, operator: 'NOT EMPTY' }));
  const featureLabels = (f: MappedFeature, suffix = ''): Labels => {
    const out: Labels = {};
    const desc = release.features[f.featureId]?.labels ?? {};
    for (const locale of project.locales) {
      if (desc[locale]) out[locale] = `${f.featureId} - ${desc[locale]}${suffix}`;
    }
    return out;
  };

  // Copy actions per source, in attribute code order. Features needing their own rule are added directly.
  const shared = new Map<string, { actions: RuleAction[]; keys: FeatureKey[] }>();
  // Class exception actions per source and class.
  const byClass = new Map<string, { source: string; classId: string; actions: RuleAction[]; keys: FeatureKey[] }>();
  for (const f of mapped) {
    const { source, parts } = f;
    const valueAttr = (parts.value ?? parts.min)!;
    const base = codes.rulePrefix + attributeCode(settings, f.key);
    const origin = { source: source.attribute, keys: [f.key] };
    const yes = source.yesValues ?? [];
    const second = f.type === 'R' ? source.second : undefined;

    if (f.type === 'L' && yes.length > 0) {
      rules.push(
        rule(`${base}_true`, [{ field: source.attribute, operator: 'IN', value: yes }], [{ type: 'set', field: valueAttr.code, value: true }], featureLabels(f, ' (true)'), origin),
        rule(
          `${base}_false`,
          [
            { field: source.attribute, operator: 'NOT EMPTY' },
            { field: source.attribute, operator: 'NOT IN', value: yes },
          ],
          [{ type: 'set', field: valueAttr.code, value: false }],
          featureLabels(f, ' (false)'),
          origin,
        ),
      );
      continue;
    }
    if (second) {
      const actions: RuleAction[] =
        parts.min && parts.max
          ? [copy(source.attribute, parts.min), copy(second, parts.max)]
          : [{ type: 'concatenate', from: [{ field: source.attribute }, { text: '-' }, { field: second }], to: { field: valueAttr.code } }];
      rules.push(rule(base, notEmpty(source.attribute, second), actions, featureLabels(f), origin));
      continue;
    }

    const actions: RuleAction[] = [];
    if (f.type === 'A') {
      const recordAttribute = sourceRecordAttribute(project, f.featureId);
      actions.push({ ...copy(source.attribute, valueAttr), reference_entity_attribute: recordAttribute });
      if (parts.label) {
        actions.push({ ...copy(source.attribute, parts.label), reference_entity_attribute: recordAttribute + codes.labelSuffix });
      }
      const entity = sourceEntityFor(project, source.attribute);
      const records = project.sourceEntities?.find((e) => e.code === entity)?.records ?? [];
      for (const classId of exceptionClassIds(records, f.featureId, featureClassIds(release, project, f.featureId))) {
        const classAttribute = classRecordAttribute(project, f.featureId, classId);
        const id = `${source.attribute}\n${classId}`;
        const entry = byClass.get(id) ?? { source: source.attribute, classId, actions: [], keys: [] };
        entry.actions.push({ ...copy(source.attribute, valueAttr), reference_entity_attribute: classAttribute });
        if (parts.label) {
          entry.actions.push({ ...copy(source.attribute, parts.label), reference_entity_attribute: classAttribute + codes.labelSuffix });
        }
        entry.keys.push(f.key);
        byClass.set(id, entry);
      }
    } else if (parts.min && parts.max) {
      actions.push(copy(source.attribute, parts.min), copy(source.attribute, parts.max));
    } else {
      actions.push(copy(source.attribute, valueAttr));
    }
    const entry = shared.get(source.attribute) ?? { actions: [], keys: [] };
    entry.actions.push(...actions);
    entry.keys.push(f.key);
    shared.set(source.attribute, entry);
  }

  for (const [source, { actions, keys }] of [...shared].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const labels: Labels = {};
    for (const locale of project.locales) labels[locale] = `ETIM (${fromWord(locale)}: ${source})`;
    rules.push(rule(codes.rulePrefix + source, notEmpty(source), actions, labels, { source, keys }));
  }

  const classRules = [...byClass.values()].sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : a.classId < b.classId ? -1 : 1));
  for (const { source, classId, actions, keys } of classRules) {
    const labels: Labels = {};
    for (const locale of project.locales) labels[locale] = `ETIM (${fromWord(locale)}: ${source}, ${classId})`;
    const classCondition: RuleFieldCondition = { field: codes.classAttribute, operator: 'IN', value: [codes.classRecordPrefix + classId.toLowerCase()] };
    rules.push(
      rule(`${codes.rulePrefix}${source}_${classId.toLowerCase()}`, [classCondition, ...notEmpty(source)], actions, labels, { source, keys }, priority + 1),
    );
  }

  const seen = new Set<string>();
  for (const r of rules) {
    if (akeneoCodeError(r.code)) issues.push({ severity: 'error', message: `Invalid rule code "${r.code}"` });
    if (seen.has(r.code)) issues.push({ severity: 'error', message: `Duplicate rule code ${r.code}` });
    seen.add(r.code);
  }
  return { rules, issues };
}

/** Warnings for sources missing from the uploaded Akeneo attributes, or with a type the rule cannot copy from. */
function checkKnownSources(
  key: FeatureKey,
  type: EtimFeatureType,
  source: SourceMapping,
  second: string | undefined,
  known: ReadonlyMap<string, SourceAttribute>,
  issues: GenerateIssue[],
): void {
  for (const code of [source.attribute, ...(second ? [second] : [])]) {
    if (!known.has(code)) {
      issues.push({ severity: 'warning', featureKey: key, message: `Source ${code} is not in the uploaded Akeneo attributes` });
    }
  }
  const attr = known.get(source.attribute);
  if (!attr?.type) return;
  if (type === 'A' && attr.type !== 'akeneo_reference_entity') {
    issues.push({
      severity: 'warning',
      featureKey: key,
      message: `Source ${attr.code} is ${attr.type}, an A feature needs a reference entity attribute (akeneo_reference_entity)`,
    });
  }
  if (type === 'L' && (source.yesValues ?? []).length === 0 && attr.type !== 'pim_catalog_boolean') {
    issues.push({
      severity: 'warning',
      featureKey: key,
      message: `Source ${attr.code} is ${attr.type}, without yes values an L feature needs a Yes/No attribute (pim_catalog_boolean), tick the yes values in step 5`,
    });
  }
}
