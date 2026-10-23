import { describe, expect, it } from 'vitest';
import { generateAttributes, generateDependencies, generateRules, type FeatureConfig, type Project } from '../src/index.js';
import { byCode, project, release } from './helpers.js';

function generate(features: Record<string, FeatureConfig>, patch: (p: Project) => void = () => {}) {
  const r = release();
  const p = project({ features });
  patch(p);
  const { attributes } = generateAttributes(r, p);
  return { ...generateRules(r, p, attributes), dependencies: generateDependencies(r, p, attributes) };
}

describe('generateDependencies', () => {
  it('shows class attributes in ETIM order, restricts unmapped A values and puts label attributes last', () => {
    const { dependencies } = generate({ EF000139: { sources: [{ attribute: 'att_surface_treatment' }] } });
    expect(dependencies[0]).toEqual({
      code: 'etim_ec000009',
      labels: { en_US: 'EC000009 - Hammer set anchor', sv_SE: 'EC000009 - Slagankare' },
      isEnabled: true,
      triggeringAttributes: [{ attribute_code: 'etim_class', operator: 'IN', values: ['ec000009'] }],
      dependentAttributes: [
        { attribute_code: 'ef005644', action: 'IS_DISPLAYED' },
        { attribute_code: 'ef005644', action: 'RESTRICTED_VALUES', values: ['ev023258', 'ev008374', 'ev008325', 'ev000154'] },
        { attribute_code: 'ef015003', action: 'IS_DISPLAYED' },
        { attribute_code: 'ef015006_eu570448', action: 'IS_DISPLAYED' },
        { attribute_code: 'ef000139', action: 'IS_DISPLAYED' },
        { attribute_code: 'ef000100_eu570073', action: 'IS_DISPLAYED' },
        { attribute_code: 'ef000139_label', action: 'IS_DISPLAYED' },
      ],
      origin: { classId: 'EC000009' },
    });
  });

  it('does not restrict an A feature without allowed values, and shows both min and max', () => {
    const { dependencies } = generate({ EF000100_EU570073: { range: 'minmax-number' } });
    const codes = dependencies[0]!.dependentAttributes.map((d) => `${d.attribute_code} ${d.action}`);
    expect(codes).toContain('ef000139 IS_DISPLAYED');
    expect(codes).not.toContain('ef000139 RESTRICTED_VALUES');
    expect(codes).toContain('ef000100_eu570073_min IS_DISPLAYED');
    expect(codes).toContain('ef000100_eu570073_max IS_DISPLAYED');
  });

  it('uses configured prefixes and codes', () => {
    const { dependencies } = generate({}, (p) => {
      p.settings.codes.dependencyPrefix = 'dep_';
      p.settings.codes.classRecordPrefix = 'c_';
      p.settings.codes.valueRecordPrefix = 'v_';
      p.settings.codes.classAttribute = 'etim_klass';
    });
    expect(dependencies[1]).toMatchObject({
      code: 'dep_c_ec000028',
      triggeringAttributes: [{ attribute_code: 'etim_klass', values: ['c_ec000028'] }],
      dependentAttributes: [
        { attribute_code: 'ef000007', action: 'IS_DISPLAYED' },
        { attribute_code: 'ef000007', action: 'RESTRICTED_VALUES', values: ['v_ev000072'] },
      ],
    });
  });
});

describe('generateRules', () => {
  it('matches the prototype rule for a mapped A feature', () => {
    const { rules, issues } = generate({ EF000139: { sources: [{ attribute: 'att_surface_treatment' }] } });
    expect(issues).toEqual([]);
    expect(rules).toEqual([
      {
        code: 'etim_ef000139',
        priority: 99,
        enabled: true,
        conditions: [
          {
            operator: 'AND',
            value: [
              { field: 'etim_class', operator: 'NOT EMPTY' },
              { field: 'att_surface_treatment', operator: 'NOT EMPTY' },
            ],
          },
        ],
        actions: [
          { type: 'copy', from_field: 'att_surface_treatment', to_field: 'ef000139', reference_entity_attribute: 'etim_value' },
          { type: 'copy', from_field: 'att_surface_treatment', to_field: 'ef000139_label', reference_entity_attribute: 'etim_label' },
        ],
        labels: { en_US: 'EF000139 - Surface protection', sv_SE: 'EF000139 - Ytskydd' },
        executionType: 'triggered',
        origin: { key: 'EF000139', source: 'att_surface_treatment' },
      },
    ]);
  });

  it('gives the preferred of several sources the lowest priority', () => {
    const { rules } = generate({ EF015006_EU570448: { sources: [{ attribute: 'att_a' }, { attribute: 'att_b' }, { attribute: 'att_c' }] } });
    expect(rules.map((r) => [r.code, r.priority, r.labels.en_US])).toEqual([
      ['etim_ef015006_eu570448_1', 97, 'EF015006 - Max. clamping thickness (from: att_a)'],
      ['etim_ef015006_eu570448_2', 98, 'EF015006 - Max. clamping thickness (from: att_b)'],
      ['etim_ef015006_eu570448_3', 99, 'EF015006 - Max. clamping thickness (from: att_c)'],
    ]);
    expect(rules[0]!.actions).toEqual([{ type: 'copy', from_field: 'att_a', to_field: 'ef015006_eu570448' }]);
  });

  it('sets true and false for L with yes values, copies a boolean source otherwise', () => {
    const withYes = generate({ EF015003: { sources: [{ attribute: 'att_preset', yesValues: ['yes', 'ja'] }] } }).rules;
    expect(withYes.map((r) => [r.code, r.conditions[0]!.value.slice(1), r.actions])).toEqual([
      ['etim_ef015003_true', [{ field: 'att_preset', operator: 'IN', value: ['yes', 'ja'] }], [{ type: 'set', field: 'ef015003', value: true }]],
      [
        'etim_ef015003_false',
        [
          { field: 'att_preset', operator: 'NOT EMPTY' },
          { field: 'att_preset', operator: 'NOT IN', value: ['yes', 'ja'] },
        ],
        [{ type: 'set', field: 'ef015003', value: false }],
      ],
    ]);
    const copy = generate({ EF015003: { sources: [{ attribute: 'att_bool' }] } }).rules;
    expect(copy.map((r) => r.actions)).toEqual([[{ type: 'copy', from_field: 'att_bool', to_field: 'ef015003' }]]);
  });

  it('concatenates two sources for a text range, copies to min and max for min/max', () => {
    const text = generate({ EF000100_EU570073: { sources: [{ attribute: 'att_from', second: 'att_to' }] } }).rules[0]!;
    expect(text.conditions[0]!.value.slice(1)).toEqual([
      { field: 'att_from', operator: 'NOT EMPTY' },
      { field: 'att_to', operator: 'NOT EMPTY' },
    ]);
    expect(text.actions).toEqual([
      { type: 'concatenate', from: [{ field: 'att_from' }, { text: '-' }, { field: 'att_to' }], to: { field: 'ef000100_eu570073' } },
    ]);

    const minmax = generate({ EF000100_EU570073: { range: 'minmax-number', sources: [{ attribute: 'att_from', second: 'att_to' }] } });
    expect(minmax.rules[0]!.actions).toEqual([
      { type: 'copy', from_field: 'att_from', to_field: 'ef000100_eu570073_min' },
      { type: 'copy', from_field: 'att_to', to_field: 'ef000100_eu570073_max' },
    ]);
    const single = generate({ EF000100_EU570073: { range: 'minmax-number', sources: [{ attribute: 'att_temp' }] } });
    expect(single.rules[0]!.actions).toEqual([
      { type: 'copy', from_field: 'att_temp', to_field: 'ef000100_eu570073_min' },
      { type: 'copy', from_field: 'att_temp', to_field: 'ef000100_eu570073_max' },
    ]);
  });

  it('reports invalid sources, negative priorities and options for the wrong type', () => {
    const bad = generate({ EF015006_EU570448: { sources: [{ attribute: 'att a' }] } });
    expect(bad.rules).toEqual([]);
    expect(bad.issues).toEqual([{ severity: 'error', featureKey: 'EF015006_EU570448', message: 'Invalid source attribute code "att a"' }]);

    const negative = generate({ EF015006_EU570448: { sources: [{ attribute: 'att_a' }, { attribute: 'att_b' }] } }, (p) => {
      p.settings.rulePriority = 0;
    });
    expect(negative.issues).toContainEqual({
      severity: 'error',
      featureKey: 'EF015006_EU570448',
      message: 'Rule priority -1 for EF015006_EU570448 is negative, raise the project rule priority',
    });

    const wrong = generate({ EF015006_EU570448: { sources: [{ attribute: 'att_a', second: 'att_b', yesValues: ['y'] }] } });
    expect(wrong.rules[0]!.conditions[0]!.value.map((c) => c.field)).toEqual(['etim_class', 'att_a']);
    expect(wrong.issues.map((i) => i.message)).toEqual([
      'Second source att_b is only used for R features, ignored',
      'Yes values are only used for L features, ignored',
    ]);
  });

  it('ignores features without sources and unselected features', () => {
    expect(generate({ EF999999: { sources: [{ attribute: 'att_x' }] } }).rules).toEqual([]);
  });
});
