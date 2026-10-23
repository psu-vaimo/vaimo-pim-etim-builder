import type { GenerateIssue } from '../akeneo/types.js';
import { akeneoCodeError } from './sources.js';
import type { ProjectSettings } from './types.js';

type CodeKey = keyof ProjectSettings['codes'];
type GroupKey = keyof ProjectSettings['groups'];

/** Code settings prepended to other codes, they may be empty. */
const PREFIXES: readonly CodeKey[] = ['attributePrefix', 'classRecordPrefix', 'valueRecordPrefix', 'rulePrefix', 'dependencyPrefix'];

/** A problem with one settings field, `field` is a dotted path like `codes.classEntity`. */
export interface SettingsIssue extends GenerateIssue {
  field: string;
  /** The problem without the field name, for showing next to the input. */
  detail: string;
}

/**
 * Checks the code and group settings: all must be valid Akeneo codes,
 * prefixes may be empty. The rule priority must be a whole number from 0.
 */
export function validateSettings(settings: ProjectSettings): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  const check = (field: string, value: string, optional: boolean) => {
    if (optional && value === '') return;
    const error = akeneoCodeError(value);
    if (error) issues.push({ severity: 'error', field, detail: error, message: `Setting ${field} "${value}": ${error}` });
  };
  for (const key of Object.keys(settings.codes) as CodeKey[]) check(`codes.${key}`, settings.codes[key], PREFIXES.includes(key));
  for (const key of Object.keys(settings.groups) as GroupKey[]) check(`groups.${key}`, settings.groups[key], false);
  if (!Number.isInteger(settings.rulePriority) || settings.rulePriority < 0) {
    const detail = 'Use a whole number from 0';
    issues.push({ severity: 'error', field: 'rulePriority', detail, message: `Setting rulePriority ${settings.rulePriority}: ${detail}` });
  }
  return issues;
}
