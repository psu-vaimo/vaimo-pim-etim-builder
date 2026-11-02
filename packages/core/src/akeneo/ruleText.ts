import type { AkeneoRule, RuleAction, RuleFieldCondition } from './types.js';

/** `etim_class NOT EMPTY`, `etim_class IN [ec000009]`. */
export function formatCondition(c: RuleFieldCondition): string {
  return c.value === undefined ? `${c.field} ${c.operator}` : `${c.field} ${c.operator} [${c.value.join(', ')}]`;
}

/** `copy att_x (etim_value) to ef000139`, `set ef015003 to true`, `concatenate att_a + "-" + att_b to ef000100`. */
export function formatAction(a: RuleAction): string {
  switch (a.type) {
    case 'copy':
      return `copy ${a.from_field}${a.reference_entity_attribute ? ` (${a.reference_entity_attribute})` : ''} to ${a.to_field}`;
    case 'set':
      return `set ${a.field} to ${String(a.value)}`;
    case 'concatenate':
      return `concatenate ${a.from.map((f) => ('field' in f ? f.field : JSON.stringify(f.text))).join(' + ')} to ${a.to.field}`;
  }
}

/** All conditions of a rule, flattened. */
export function ruleConditions(rule: AkeneoRule): string[] {
  return rule.conditions.flatMap((g) => g.value.map(formatCondition));
}
