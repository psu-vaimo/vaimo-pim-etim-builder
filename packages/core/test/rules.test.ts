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
  it('generates one rule per source attribute for a mapped A feature, copying the ref_ record attributes', () => {
    const { rules, issues } = generate({ EF000139: { sources: [{ attribute: 'att_surface_treatment' }] } });
    expect(issues).toEqual([]);
    expect(rules).toEqual([
      {
        code: 'etim_att_surface_treatment',
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
          { type: 'copy', from_field: 'att_surface_treatment', to_field: 'ef000139', reference_entity_attribute: 'ref_ef000139' },
          { type: 'copy', from_field: 'att_surface_treatment', to_field: 'ef000139_label', reference_entity_attribute: 'ref_ef000139_label' },
        ],
        labels: { en_US: 'ETIM (from: att_surface_treatment)', sv_SE: 'ETIM (från: att_surface_treatment)' },
        executionType: 'triggered',
        origin: { source: 'att_surface_treatment', keys: ['EF000139'] },
      },
    ]);
  });

  it('puts one copy action per feature in the rule of a shared source', () => {
    const { rules, issues } = generate({
      EF000139: { sources: [{ attribute: 'att_product' }] },
      EF005644: { sources: [{ attribute: 'att_product' }] },
      EF015006_EU570448: { sources: [{ attribute: 'att_product' }] },
      EF000100_EU570073: { range: 'minmax-number', sources: [{ attribute: 'att_temp' }] },
    });
    expect(issues).toEqual([]);
    expect(rules.map((r) => [r.code, r.priority, r.origin.keys])).toEqual([
      ['etim_att_product', 99, ['EF000139', 'EF005644', 'EF015006_EU570448']],
      ['etim_att_temp', 99, ['EF000100_EU570073']],
    ]);
    expect(rules[0]!.actions).toEqual([
      { type: 'copy', from_field: 'att_product', to_field: 'ef000139', reference_entity_attribute: 'ref_ef000139' },
      { type: 'copy', from_field: 'att_product', to_field: 'ef000139_label', reference_entity_attribute: 'ref_ef000139_label' },
      { type: 'copy', from_field: 'att_product', to_field: 'ef005644', reference_entity_attribute: 'ref_ef005644' },
      { type: 'copy', from_field: 'att_product', to_field: 'ef005644_label', reference_entity_attribute: 'ref_ef005644_label' },
      { type: 'copy', from_field: 'att_product', to_field: 'ef015006_eu570448' },
    ]);
    expect(rules[1]!.actions).toEqual([
      { type: 'copy', from_field: 'att_temp', to_field: 'ef000100_eu570073_min' },
      { type: 'copy', from_field: 'att_temp', to_field: 'ef000100_eu570073_max' },
    ]);
  });

  it('uses the configured record attribute prefix and label suffix', () => {
    const { rules } = generate({ EF000139: { sources: [{ attribute: 'att_x' }] } }, (p) => {
      p.settings.codes.sourceRecordAttributePrefix = 'etim_';
      p.settings.codes.labelSuffix = '_text';
    });
    expect(rules[0]!.actions.map((a) => (a.type === 'copy' ? a.reference_entity_attribute : ''))).toEqual(['etim_ef000139', 'etim_ef000139_text']);
  });

  it('gives L with yes values its own true and false rules, copies a boolean source in the shared rule', () => {
    const withYes = generate({ EF015003: { sources: [{ attribute: 'att_preset', yesValues: ['yes', 'ja'] }] } }).rules;
    expect(withYes.map((r) => [r.code, r.conditions[0]!.value.slice(1), r.actions, r.labels.en_US])).toEqual([
      [
        'etim_ef015003_true',
        [{ field: 'att_preset', operator: 'IN', value: ['yes', 'ja'] }],
        [{ type: 'set', field: 'ef015003', value: true }],
        'EF015003 - Pre-positioned installation (true)',
      ],
      [
        'etim_ef015003_false',
        [
          { field: 'att_preset', operator: 'NOT EMPTY' },
          { field: 'att_preset', operator: 'NOT IN', value: ['yes', 'ja'] },
        ],
        [{ type: 'set', field: 'ef015003', value: false }],
        'EF015003 - Pre-positioned installation (false)',
      ],
    ]);
    const copy = generate({ EF015003: { sources: [{ attribute: 'att_bool' }] } }).rules;
    expect(copy.map((r) => [r.code, r.actions])).toEqual([['etim_att_bool', [{ type: 'copy', from_field: 'att_bool', to_field: 'ef015003' }]]]);
  });

  it('gives a range with a second source its own rule, concatenating for text and copying to min and max', () => {
    const text = generate({ EF000100_EU570073: { sources: [{ attribute: 'att_from', second: 'att_to' }] } }).rules[0]!;
    expect(text.code).toBe('etim_ef000100_eu570073');
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
  });

  it('reports invalid sources, a negative priority and options for the wrong type', () => {
    const bad = generate({ EF015006_EU570448: { sources: [{ attribute: 'att a' }] } });
    expect(bad.rules).toEqual([]);
    expect(bad.issues).toEqual([{ severity: 'error', featureKey: 'EF015006_EU570448', message: 'Invalid source attribute code "att a"' }]);

    const negative = generate({ EF015006_EU570448: { sources: [{ attribute: 'att_a' }] } }, (p) => {
      p.settings.rulePriority = -1;
    });
    expect(negative.issues).toContainEqual({ severity: 'error', message: 'Rule priority -1 is negative, raise the project rule priority' });

    const wrong = generate({ EF015006_EU570448: { sources: [{ attribute: 'att_a', second: 'att_b', yesValues: ['y'] }] } });
    expect(wrong.rules[0]!.conditions[0]!.value.map((c) => c.field)).toEqual(['etim_class', 'att_a']);
    expect(wrong.issues.map((i) => i.message)).toEqual([
      'Second source att_b is only used for R features, ignored',
      'Yes values are only used for L features, ignored',
    ]);
  });

  it('allows one source per feature, more is an error and the first is used', () => {
    const { rules, issues } = generate({ EF015006_EU570448: { sources: [{ attribute: 'att_a' }, { attribute: 'att_b' }] } });
    expect(rules.map((r) => r.code)).toEqual(['etim_att_a']);
    expect(issues).toEqual([
      { severity: 'error', featureKey: 'EF015006_EU570448', message: 'EF015006_EU570448 has 2 sources, only one is allowed. Using att_a' },
    ]);
  });

  it('reports rule codes that collide', () => {
    const { issues } = generate({
      EF000100_EU570073: { sources: [{ attribute: 'att_from', second: 'att_to' }] },
      EF015006_EU570448: { sources: [{ attribute: 'ef000100_eu570073' }] },
    });
    expect(issues).toContainEqual({ severity: 'error', message: 'Duplicate rule code etim_ef000100_eu570073' });
  });

  it('checks sources against uploaded Akeneo attributes', () => {
    const { issues } = generate(
      {
        EF000139: { sources: [{ attribute: 'att_text' }] },
        EF015003: { sources: [{ attribute: 'att_select' }] },
        EF015006_EU570448: { sources: [{ attribute: 'att_unknown' }] },
        EF005644: { sources: [{ attribute: 'att_ref' }] },
      },
      (p) => {
        p.sourceAttributes = [
          { code: 'att_text', type: 'pim_catalog_text', labels: {} },
          { code: 'att_select', type: 'pim_catalog_simpleselect', labels: {} },
          { code: 'att_ref', type: 'akeneo_reference_entity', labels: {} },
        ];
      },
    );
    expect(issues.map((i) => [i.featureKey, i.message])).toEqual([
      ['EF000139', 'Source att_text is pim_catalog_text, an A feature needs a reference entity attribute (akeneo_reference_entity)'],
      ['EF015003', 'Source att_select is pim_catalog_simpleselect, without yes values an L feature needs a Yes/No attribute (pim_catalog_boolean), tick the yes values in step 5'],
      ['EF015006_EU570448', 'Source att_unknown is not in the uploaded Akeneo attributes'],
    ]);
  });

  it('ignores features without sources and unselected features', () => {
    expect(generate({ EF999999: { sources: [{ attribute: 'att_x' }] } }).rules).toEqual([]);
  });
});

describe('class exception rules', () => {
  it('adds a rule per source and class with exceptions, one priority higher so it runs after the default rule', () => {
    const r = release();
    r.classes.EC000028!.features.push({ nr: '998', featureId: 'EF005644', type: 'A', sortNr: 9, valueIds: ['EV000072'] });
    const p = project({
      features: { EF005644: { sources: [{ attribute: 'att_fastening' }] } },
      sourceEntityLinks: { att_fastening: 'fastening' },
      sourceEntities: [
        { code: 'fastening', records: [{ code: 'eye', labels: {}, values: { EF005644: 'EV023258' }, classValues: { EC000028: { EF005644: 'EV000072' } } }] },
      ],
    });
    const { attributes } = generateAttributes(r, p);
    const { rules, issues } = generateRules(r, p, attributes);
    expect(issues).toEqual([]);
    expect(rules.map((x) => [x.code, x.priority])).toEqual([
      ['etim_att_fastening', 99],
      ['etim_att_fastening_ec000028', 100],
    ]);
    expect(rules[1]).toMatchObject({
      conditions: [
        {
          operator: 'AND',
          value: [
            { field: 'etim_class', operator: 'NOT EMPTY' },
            { field: 'etim_class', operator: 'IN', value: ['ec000028'] },
            { field: 'att_fastening', operator: 'NOT EMPTY' },
          ],
        },
      ],
      actions: [
        { type: 'copy', from_field: 'att_fastening', to_field: 'ef005644', reference_entity_attribute: 'ref_ef005644_ec000028' },
        { type: 'copy', from_field: 'att_fastening', to_field: 'ef005644_label', reference_entity_attribute: 'ref_ef005644_ec000028_label' },
      ],
      labels: { en_US: 'ETIM (from: att_fastening, EC000028)', sv_SE: 'ETIM (från: att_fastening, EC000028)' },
      origin: { source: 'att_fastening', keys: ['EF005644'] },
    });
  });
});
