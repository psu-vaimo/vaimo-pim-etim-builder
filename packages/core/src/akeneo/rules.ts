import type { EtimRelease, Labels } from '../etim/types.js';
import type { FeatureKey, Project, SourceMapping } from '../project/types.js';
import { defaultSettings } from '../project/defaults.js';
import { akeneoCodeError } from '../project/sources.js';
import { attributeCode } from './attributes.js';
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

/**
 * Generates the enrichment rules for mapped features, from the attributes
 * returned by `generateAttributes`. One rule per source (two for L with yes
 * values), conditions: class attribute and source NOT EMPTY.
 *
 * Several sources: Akeneo runs higher priority rules first and later rules
 * overwrite, so the preferred source gets the lowest priority. With project
 * priority P and n sources, source i (0 = preferred) gets P - (n - 1 - i).
 *
 * | ETIM | action |
 * |---|---|
 * | A | copy the source record's value attribute to the feature, its label attribute to `<code>_label` |
 * | N | copy |
 * | L | yes values: set true when IN, set false when NOT IN. No yes values: copy (boolean source) |
 * | R text | copy, or with `second` concatenate as `10-20` |
 * | R min/max | copy to min, copy `second` (or the same source) to max |
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

  const byKey = new Map<FeatureKey, Partial<Record<FeaturePart, AkeneoAttribute>>>();
  for (const a of attributes) {
    if (a.origin.kind !== 'feature') continue;
    byKey.set(a.origin.key, { ...byKey.get(a.origin.key), [a.origin.part]: a });
  }

  for (const [key, parts] of byKey) {
    const sources = project.features[key]?.sources ?? [];
    if (sources.length === 0) continue;
    const valueAttr = parts.value ?? parts.min;
    if (!valueAttr || valueAttr.origin.kind !== 'feature') continue;
    const { featureId, etimType: featureType } = valueAttr.origin;
    const featureLabels = release.features[featureId]?.labels ?? {};
    const base = codes.rulePrefix + attributeCode(settings, key);

    const seen = new Set<string>();
    sources.forEach((source, i) => {
      if (seen.has(source.attribute)) {
        issues.push({ severity: 'error', featureKey: key, message: `Source ${source.attribute} is listed twice for ${key}, its rule could never win` });
        return;
      }
      seen.add(source.attribute);
      const second = featureType === 'R' ? source.second : undefined;
      const fields = [source.attribute, ...(second ? [second] : [])];
      const bad = fields.filter((f) => akeneoCodeError(f) !== undefined);
      if (bad.length > 0) {
        issues.push({ severity: 'error', featureKey: key, message: `Invalid source attribute code "${bad.join('", "')}"` });
        return;
      }
      const priority = settings.rulePriority - (sources.length - 1 - i);
      if (priority < 0) {
        issues.push({
          severity: 'error',
          featureKey: key,
          message: `Rule priority ${priority} for ${key} is negative, raise the project rule priority`,
        });
      }
      const code = sources.length > 1 ? `${base}_${i + 1}` : base;
      const labels = (suffix = ''): Labels => {
        const out: Labels = {};
        for (const locale of project.locales) {
          const desc = featureLabels[locale];
          if (!desc) continue;
          const from = settings.labelTexts[locale]?.from ?? settings.labelTexts.en_US?.from ?? FALLBACK_FROM;
          out[locale] = `${featureId} - ${desc}${sources.length > 1 ? ` (${from}: ${source.attribute})` : ''}${suffix}`;
        }
        return out;
      };
      const rule = (ruleCode: string, conditions: RuleFieldCondition[], actions: RuleAction[], suffix?: string): AkeneoRule => ({
        code: ruleCode,
        priority,
        enabled: true,
        conditions: [{ operator: 'AND', value: [{ field: codes.classAttribute, operator: 'NOT EMPTY' }, ...conditions] }],
        actions,
        labels: labels(suffix),
        executionType: 'triggered',
        origin: { key, source: source.attribute },
      });
      const notEmpty = fields.map((field): RuleFieldCondition => ({ field, operator: 'NOT EMPTY' }));
      const copy = (from: string, to: AkeneoAttribute): CopyAction => ({ type: 'copy', from_field: from, to_field: to.code });

      switch (featureType) {
        case 'A': {
          const actions: RuleAction[] = [{ ...copy(source.attribute, valueAttr), reference_entity_attribute: codes.sourceValueAttribute }];
          if (parts.label) {
            actions.push({ ...copy(source.attribute, parts.label), reference_entity_attribute: codes.sourceLabelAttribute });
          }
          rules.push(rule(code, notEmpty, actions));
          break;
        }
        case 'L':
          rules.push(...booleanRules(source, code, valueAttr, rule, copy, notEmpty));
          break;
        case 'R':
          if (parts.min && parts.max) {
            rules.push(rule(code, notEmpty, [copy(source.attribute, parts.min), copy(second ?? source.attribute, parts.max)]));
          } else if (second) {
            rules.push(
              rule(code, notEmpty, [
                {
                  type: 'concatenate',
                  from: [{ field: source.attribute }, { text: '-' }, { field: second }],
                  to: { field: valueAttr.code },
                },
              ]),
            );
          } else {
            rules.push(rule(code, notEmpty, [copy(source.attribute, valueAttr)]));
          }
          break;
        default:
          rules.push(rule(code, notEmpty, [copy(source.attribute, valueAttr)]));
      }

      if (source.second && featureType !== 'R') {
        issues.push({ severity: 'warning', featureKey: key, message: `Second source ${source.second} is only used for R features, ignored` });
      }
      if (source.yesValues && featureType !== 'L') {
        issues.push({ severity: 'warning', featureKey: key, message: `Yes values are only used for L features, ignored` });
      }
    });
  }
  return { rules, issues };
}

function booleanRules(
  source: SourceMapping,
  code: string,
  target: AkeneoAttribute,
  rule: (code: string, conditions: RuleFieldCondition[], actions: RuleAction[], suffix?: string) => AkeneoRule,
  copy: (from: string, to: AkeneoAttribute) => CopyAction,
  notEmpty: RuleFieldCondition[],
): AkeneoRule[] {
  const yes = source.yesValues ?? [];
  if (yes.length === 0) return [rule(code, notEmpty, [copy(source.attribute, target)])];
  return [
    rule(`${code}_true`, [{ field: source.attribute, operator: 'IN', value: yes }], [{ type: 'set', field: target.code, value: true }], ' (true)'),
    rule(
      `${code}_false`,
      [
        { field: source.attribute, operator: 'NOT EMPTY' },
        { field: source.attribute, operator: 'NOT IN', value: yes },
      ],
      [{ type: 'set', field: target.code, value: false }],
      ' (false)',
    ),
  ];
}
