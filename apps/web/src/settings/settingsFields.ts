import { attributeCode, type LabelTexts, type ProjectSettings, type SettingsIssue } from '@akeneo-etim/core';

type CodeKey = keyof ProjectSettings['codes'];
type GroupKey = keyof ProjectSettings['groups'];

export interface FieldInfo<K extends string> {
  key: K;
  label: string;
  description: string;
}

/** Code settings in the order shown, prefixes first. */
export const CODE_FIELDS: readonly FieldInfo<CodeKey>[] = [
  { key: 'attributePrefix', label: 'Attribute code prefix', description: 'Before every ETIM attribute code, may be empty' },
  { key: 'classRecordPrefix', label: 'Class record prefix', description: 'Before class record codes, may be empty' },
  { key: 'valueRecordPrefix', label: 'Value record prefix', description: 'Before value record codes, may be empty' },
  { key: 'rulePrefix', label: 'Rule code prefix', description: 'Before rule codes, may be empty' },
  { key: 'dependencyPrefix', label: 'Dependency code prefix', description: 'Before dependency codes, may be empty' },
  { key: 'classEntity', label: 'Class reference entity', description: 'Reference entity holding the ETIM classes' },
  { key: 'valueEntity', label: 'Value reference entity', description: 'Reference entity holding the ETIM values' },
  { key: 'classAttribute', label: 'Class attribute', description: 'Product attribute linking a product to its ETIM class' },
  { key: 'labelSuffix', label: 'Label attribute suffix', description: 'Added to mapped A attributes for the value label' },
  {
    key: 'sourceRecordAttributePrefix',
    label: 'Source record attribute prefix',
    description: 'Before the feature id, record attribute on the client source entities holding the ETIM value code (ref_ef000139)',
  },
];

export const GROUP_FIELDS: readonly FieldInfo<GroupKey>[] = [
  { key: 'general', label: 'Class attribute group', description: 'Group of the class attribute' },
  { key: 'mapped', label: 'Mapped group', description: 'Features filled from client attributes' },
  { key: 'unmapped', label: 'Unmapped group', description: 'All other ETIM features' },
];

export const LABEL_FIELDS: readonly FieldInfo<keyof LabelTexts>[] = [
  { key: 'from', label: 'From', description: 'Mapped labels, (from: att_x)' },
  { key: 'description', label: 'Description', description: 'Label attributes, EF000139 - Surface protection - Description' },
  { key: 'min', label: 'Min', description: 'Range min attributes' },
  { key: 'max', label: 'Max', description: 'Range max attributes' },
  { key: 'classAttribute', label: 'Class attribute label', description: 'Label of the class attribute' },
];

/** Label words for a locale, falling back like the generators do: the locale, then en_US. */
export function labelTextsFor(settings: ProjectSettings, locale: string): LabelTexts | undefined {
  return settings.labelTexts[locale] ?? settings.labelTexts.en_US;
}

/** Validation messages by field path, e.g. `codes.classEntity`. */
export function errorsByField(issues: readonly SettingsIssue[]): Record<string, string> {
  return Object.fromEntries(issues.map((i) => [i.field, i.detail]));
}

/** Example codes for the current settings, from the prototype's EF000008/EC000009/EV000072. */
export function codeExamples(settings: ProjectSettings): { label: string; code: string }[] {
  const { codes } = settings;
  const attr = attributeCode(settings, 'EF000139');
  const classRecord = `${codes.classRecordPrefix}ec000009`;
  return [
    { label: 'Attribute', code: attributeCode(settings, 'EF000008_EU570448') },
    { label: 'Label attribute', code: `${attr}${codes.labelSuffix}` },
    { label: 'Class record', code: classRecord },
    { label: 'Value record', code: `${codes.valueRecordPrefix}ev000072` },
    { label: 'Rule', code: `${codes.rulePrefix}att_surface_treatment` },
    { label: 'Source record attribute', code: `${codes.sourceRecordAttributePrefix}ef000139` },
    { label: 'Dependency', code: `${codes.dependencyPrefix}${classRecord}` },
  ];
}
