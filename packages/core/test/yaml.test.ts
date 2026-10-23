import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { toYaml } from '../src/export/yaml.js';

const roundTrip = (doc: Record<string, unknown>) => {
  const text = toYaml(doc);
  expect(parse(text)).toEqual(doc);
  expect(parse(text, { version: '1.1' })).toEqual(doc);
  return text;
};

describe('toYaml', () => {
  it('writes block style with list items starting on the dash line', () => {
    expect(
      toYaml({
        rules: {
          etim_ef000139: {
            priority: 99,
            enabled: true,
            conditions: [{ operator: 'AND', value: [{ field: 'etim_class', operator: 'NOT EMPTY' }] }],
            triggers: {},
          },
        },
      }),
    ).toBe(
      [
        'rules:',
        '  etim_ef000139:',
        '    priority: 99',
        '    enabled: true',
        '    conditions:',
        '      - operator: AND',
        '        value:',
        '          - field: etim_class',
        '            operator: "NOT EMPTY"',
        '    triggers: {}',
        '',
      ].join('\n'),
    );
  });

  it('round trips tricky strings in YAML 1.1 and 1.2', () => {
    roundTrip({
      strings: ['yes', 'No', 'on', 'OFF', 'null', 'true', '123', '1.5', '0x1f', '', ' lead', 'a: b', '#c', '- d', '"q"', "it's", 'line\nbreak', 'Färg °C', 'ev000072', '~', '@x', '*a', '&a'],
    });
  });

  it('round trips nested lists, objects, null and empty values', () => {
    roundTrip({
      a: { b: [{ c: [{ d: 1, e: [] }], f: {} }, 'plain', null], g: false },
      dependencies: {
        etim_ec000009: {
          product_selections: [{ property: 'family', operator: 'ALL', values: null }],
          dependent_attributes: [{ attribute_code: 'ef1', action: 'RESTRICTED_VALUES', values: ['ev1', 'ev2'] }],
        },
      },
    });
  });

  it('leaves out undefined fields', () => {
    expect(toYaml({ a: { b: undefined, c: 1 } })).toBe('a:\n  c: 1\n');
  });
});
