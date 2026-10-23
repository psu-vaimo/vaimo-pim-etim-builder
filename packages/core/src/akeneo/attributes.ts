import type { EtimRelease, Labels } from '../etim/types.js';
import { defaultSettings } from '../project/defaults.js';
import type { FeatureKey, LabelTexts, NumericSetup, Project, ProjectSettings } from '../project/types.js';
import { collectProjectFeatures, type ProjectFeature } from './features.js';
import type { AkeneoAttribute, AkeneoAttributeType, FeaturePart, GenerateIssue } from './types.js';

const AKENEO_CODE = /^[a-zA-Z0-9_]+$/;
const AKENEO_CODE_MAX = 100;
const FALLBACK_TEXTS = defaultSettings().labelTexts.en_US!;

type Draft = Omit<AkeneoAttribute, 'sortOrder'>;

/** Base attribute code for a feature key, `EF000008_EU570448` gives `ef000008_eu570448`. */
export function attributeCode(settings: ProjectSettings, key: FeatureKey): string {
  return settings.codes.attributePrefix + key.toLowerCase();
}

/**
 * Generates the Akeneo attributes for the selected classes: the class
 * attribute first, then one attribute per feature+unit combination (two for
 * min/max ranges, plus a label attribute for mapped A features), sorted by code.
 *
 * - Unmapped: A is a reference entity link, N number or metric, L boolean,
 *   R text or min/max. Group `unmapped`, editable.
 * - Mapped (has sources): same types, except A becomes text with a `_label`
 *   text companion. Group `mapped`, read only, label ends with `(from: ...)`.
 */
export function generateAttributes(
  release: EtimRelease,
  project: Project,
): { attributes: AkeneoAttribute[]; issues: GenerateIssue[] } {
  const { settings } = project;
  const { features, issues } = collectProjectFeatures(release, project);
  const textsFor = (locale: string): LabelTexts => settings.labelTexts[locale] ?? settings.labelTexts.en_US ?? FALLBACK_TEXTS;

  const drafts: Draft[] = [
    {
      code: settings.codes.classAttribute,
      type: 'akeneo_reference_entity',
      labels: Object.fromEntries(project.locales.map((l) => [l, textsFor(l).classAttribute])),
      group: settings.groups.general,
      readOnly: false,
      referenceDataName: settings.codes.classEntity,
      origin: { kind: 'class' },
    },
  ];

  for (const feature of features) {
    drafts.push(...featureAttributes(feature, release, project, textsFor, issues));
  }

  const seen = new Set<string>();
  for (const d of drafts) {
    if (!AKENEO_CODE.test(d.code) || d.code.length > AKENEO_CODE_MAX) {
      issues.push({ severity: 'error', message: `Invalid Akeneo attribute code "${d.code}"` });
    }
    if (seen.has(d.code)) issues.push({ severity: 'error', message: `Duplicate attribute code ${d.code}` });
    seen.add(d.code);
  }

  return { attributes: drafts.map((d, i) => ({ ...d, sortOrder: i + 1 })), issues };
}

function featureAttributes(
  feature: ProjectFeature,
  release: EtimRelease,
  project: Project,
  textsFor: (locale: string) => LabelTexts,
  issues: GenerateIssue[],
): Draft[] {
  const { settings } = project;
  const config = project.features[feature.key] ?? {};
  const sources = (config.sources ?? []).map((s) => s.attribute);
  const mapped = sources.length > 0;
  const code = attributeCode(settings, feature.key);

  const featureLabels = release.features[feature.featureId]?.labels ?? {};
  const unitLabels = feature.unitId ? (release.units[feature.unitId]?.labels ?? {}) : undefined;
  const missing = project.locales.filter((l) => !featureLabels[l]);
  if (missing.length > 0) {
    issues.push({
      severity: 'warning',
      featureKey: feature.key,
      message: `No ${feature.featureId} label for ${missing.join(', ')}, label left empty`,
    });
  }

  const labels = (part: FeaturePart): Labels => {
    const out: Labels = {};
    for (const locale of project.locales) {
      const desc = featureLabels[locale];
      if (!desc) continue;
      const t = textsFor(locale);
      let label = `${feature.featureId} - ${desc}`;
      if (part === 'label') label += ` - ${t.description}`;
      if (part === 'min') label += ` - ${t.min}`;
      if (part === 'max') label += ` - ${t.max}`;
      if (unitLabels && part !== 'label') {
        const unit = unitLabels[locale] ?? Object.values(unitLabels)[0];
        if (unit) label += ` [${unit}]`;
      }
      if (mapped && part !== 'label') label += ` (${t.from}: ${sources.join(', ')})`;
      out[locale] = label;
    }
    return out;
  };

  const base = (part: FeaturePart, attrCode: string, type: AkeneoAttributeType): Draft => ({
    code: attrCode,
    type,
    labels: labels(part),
    group: mapped ? settings.groups.mapped : settings.groups.unmapped,
    readOnly: mapped,
    origin: {
      kind: 'feature',
      key: feature.key,
      featureId: feature.featureId,
      ...(feature.unitId ? { unitId: feature.unitId } : {}),
      etimType: feature.type,
      part,
    },
  });

  const numeric = (part: FeaturePart, attrCode: string, setup: NumericSetup): Draft => {
    const unit = feature.unitId ? settings.unitMap[feature.unitId] : undefined;
    if (setup === 'metric' && !unit) {
      issues.push({
        severity: 'error',
        featureKey: feature.key,
        message: feature.unitId
          ? `Unit ${feature.unitId} has no Akeneo measurement mapping, ${attrCode} falls back to number`
          : `${feature.key} has no unit, ${attrCode} falls back to number`,
      });
    }
    const metric = setup === 'metric' && unit;
    return {
      ...base(part, attrCode, metric ? 'pim_catalog_metric' : 'pim_catalog_number'),
      decimalsAllowed: true,
      negativeAllowed: true,
      ...(metric ? { metricFamily: unit.family, defaultMetricUnit: unit.unit } : {}),
    };
  };

  switch (feature.type) {
    case 'A':
      if (!mapped) {
        return [{ ...base('value', code, 'akeneo_reference_entity'), referenceDataName: settings.codes.valueEntity }];
      }
      return [base('value', code, 'pim_catalog_text'), base('label', code + settings.codes.labelSuffix, 'pim_catalog_text')];
    case 'N':
      return [numeric('value', code, config.numeric ?? settings.numeric)];
    case 'L':
      return [base('value', code, 'pim_catalog_boolean')];
    case 'R': {
      const range = config.range ?? settings.range;
      if (range === 'text') return [base('value', code, 'pim_catalog_text')];
      const setup: NumericSetup = range === 'minmax-metric' ? 'metric' : 'number';
      return [numeric('min', `${code}_min`, setup), numeric('max', `${code}_max`, setup)];
    }
  }
}
