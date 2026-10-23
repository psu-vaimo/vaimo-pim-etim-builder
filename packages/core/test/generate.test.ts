import { describe, expect, it } from 'vitest';
import { generateAttributes, generateRecords } from '../src/index.js';
import { byCode, project, release } from './helpers.js';

describe('generateAttributes', () => {
  it('generates the class attribute first, then features sorted by code', () => {
    const { attributes } = generateAttributes(release(), project());
    expect(attributes.map((a) => [a.sortOrder, a.code, a.type])).toEqual([
      [1, 'etim_class', 'akeneo_reference_entity'],
      [2, 'ef000007', 'akeneo_reference_entity'],
      [3, 'ef000100_eu570073', 'pim_catalog_text'],
      [4, 'ef000139', 'akeneo_reference_entity'],
      [5, 'ef005644', 'akeneo_reference_entity'],
      [6, 'ef015003', 'pim_catalog_boolean'],
      [7, 'ef015006_eu570448', 'pim_catalog_number'],
    ]);
  });

  it('matches the prototype for unmapped attributes', () => {
    const a = byCode(generateAttributes(release(), project()).attributes);
    expect(a.etim_class).toMatchObject({
      labels: { en_US: 'ETIM class', sv_SE: 'ETIM-klass' },
      group: 'etim',
      referenceDataName: 'etim_class',
      origin: { kind: 'class' },
    });
    expect(a.ef000139).toEqual({
      code: 'ef000139',
      type: 'akeneo_reference_entity',
      labels: { en_US: 'EF000139 - Surface protection', sv_SE: 'EF000139 - Ytskydd' },
      group: 'etim_unmapped',
      sortOrder: 4,
      readOnly: false,
      referenceDataName: 'etim_value',
      origin: { kind: 'feature', key: 'EF000139', featureId: 'EF000139', etimType: 'A', part: 'value' },
    });
    expect(a.ef015006_eu570448).toMatchObject({
      labels: { en_US: 'EF015006 - Max. clamping thickness [mm]' },
      decimalsAllowed: true,
      negativeAllowed: true,
      origin: { unitId: 'EU570448' },
    });
  });

  it('matches the prototype for a mapped A feature', () => {
    const p = project({ features: { EF000139: { sources: [{ attribute: 'att_surface_treatment' }] } } });
    const a = byCode(generateAttributes(release(), p).attributes);
    expect(a.ef000139).toMatchObject({
      type: 'pim_catalog_text',
      labels: {
        en_US: 'EF000139 - Surface protection (from: att_surface_treatment)',
        sv_SE: 'EF000139 - Ytskydd (från: att_surface_treatment)',
      },
      group: 'etim_mapped',
      readOnly: true,
    });
    expect(a.ef000139).not.toHaveProperty('referenceDataName');
    expect(a.ef000139_label).toMatchObject({
      type: 'pim_catalog_text',
      labels: { en_US: 'EF000139 - Surface protection - Description', sv_SE: 'EF000139 - Ytskydd - Beskrivning' },
      group: 'etim_mapped',
      readOnly: true,
      origin: { part: 'label' },
    });
    expect(a.ef000139_label!.sortOrder).toBe(a.ef000139!.sortOrder + 1);
  });

  it('lists all sources in order in the label of a mapped non-A feature', () => {
    const p = project({ features: { EF015006_EU570448: { sources: [{ attribute: 'att_a' }, { attribute: 'att_b' }] } } });
    const a = byCode(generateAttributes(release(), p).attributes);
    expect(a.ef015006_eu570448).toMatchObject({
      type: 'pim_catalog_number',
      labels: { en_US: 'EF015006 - Max. clamping thickness [mm] (from: att_a, att_b)' },
      readOnly: true,
      group: 'etim_mapped',
    });
    expect(a).not.toHaveProperty('ef015006_eu570448_label');
  });

  it('uses metric when the unit is mapped and falls back to number with an error otherwise', () => {
    const p = project();
    p.settings.numeric = 'metric';
    p.settings.unitMap.EU570448 = { family: 'Length', unit: 'MILLIMETER' };
    expect(byCode(generateAttributes(release(), p).attributes).ef015006_eu570448).toMatchObject({
      type: 'pim_catalog_metric',
      metricFamily: 'Length',
      defaultMetricUnit: 'MILLIMETER',
    });

    p.settings.unitMap = {};
    const { attributes, issues } = generateAttributes(release(), p);
    expect(byCode(attributes).ef015006_eu570448?.type).toBe('pim_catalog_number');
    expect(issues).toContainEqual({
      severity: 'error',
      featureKey: 'EF015006_EU570448',
      message: 'Unit EU570448 has no Akeneo measurement mapping, ef015006_eu570448 falls back to number',
    });
  });

  it('quietly uses number for a unitless N under a metric default, errors on an explicit override', () => {
    const r = release();
    r.classes.EC000028!.features.push({ nr: '997', featureId: 'EF015006', type: 'N', sortNr: 9, valueIds: [] });
    const p = project();
    p.settings.numeric = 'metric';
    p.settings.unitMap.EU570448 = { family: 'Length', unit: 'MILLIMETER' };
    const quiet = generateAttributes(r, p);
    expect(byCode(quiet.attributes).ef015006?.type).toBe('pim_catalog_number');
    expect(quiet.issues.filter((i) => i.severity === 'error')).toEqual([]);

    p.features.EF015006 = { numeric: 'metric' };
    expect(generateAttributes(r, p).issues).toContainEqual({
      severity: 'error',
      featureKey: 'EF015006',
      message: 'EF015006 has no unit, metric is not possible, using number',
    });
  });

  it('treats a half filled unit mapping as missing and reports a min/max range once', () => {
    const p = project({ features: { EF000100_EU570073: { range: 'minmax-metric' } } });
    p.settings.unitMap.EU570073 = { family: 'Temperature', unit: ' ' };
    const { attributes, issues } = generateAttributes(release(), p);
    expect(byCode(attributes).ef000100_eu570073_min?.type).toBe('pim_catalog_number');
    expect(issues.filter((i) => i.featureKey === 'EF000100_EU570073')).toEqual([
      {
        severity: 'error',
        featureKey: 'EF000100_EU570073',
        message: 'Unit EU570073 has no Akeneo measurement mapping, ef000100_eu570073 falls back to number',
      },
    ]);
  });

  it('generates min/max for ranges, with per feature override and unit label fallback', () => {
    const p = project({ features: { EF000100_EU570073: { range: 'minmax-number' } } });
    const a = byCode(generateAttributes(release(), p).attributes);
    expect(a).not.toHaveProperty('ef000100_eu570073');
    expect(a.ef000100_eu570073_min).toMatchObject({
      type: 'pim_catalog_number',
      labels: { en_US: 'EF000100 - Temperature range - Min [°C]', sv_SE: 'EF000100 - Temperaturområde - Min [°C]' },
      origin: { part: 'min' },
    });
    expect(a.ef000100_eu570073_max?.labels.en_US).toBe('EF000100 - Temperature range - Max [°C]');
  });

  it('applies the attribute prefix and validates codes', () => {
    const p = project();
    p.settings.codes.attributePrefix = 'etim_';
    expect(byCode(generateAttributes(release(), p).attributes)).toHaveProperty('etim_ef000139');

    p.settings.codes.attributePrefix = 'bad-';
    expect(generateAttributes(release(), p).issues).toContainEqual({
      severity: 'error',
      message: 'Invalid Akeneo attribute code "bad-ef000007"',
    });
  });

  it('warns about missing labels and unknown classes', () => {
    const { issues } = generateAttributes(release(), project({ classIds: ['EC000009', 'EC404'] }));
    expect(issues).toContainEqual({
      severity: 'warning',
      classId: 'EC404',
      message: 'Class EC404 is not in the ETIM release, skipped',
    });
    expect(issues).toContainEqual({
      severity: 'warning',
      message: '2 features have no sv_SE label, their attribute labels are left empty: EF015003, EF015006',
    });
  });

  it('warns when a feature has different types across classes', () => {
    const r = release();
    r.classes.EC000028!.features.push({ nr: '998', featureId: 'EF015003', type: 'A', sortNr: 9, valueIds: [] });
    const { attributes, issues } = generateAttributes(r, project());
    expect(byCode(attributes).ef015003?.type).toBe('pim_catalog_boolean');
    expect(issues).toContainEqual({
      severity: 'warning',
      featureKey: 'EF015003',
      classId: 'EC000028',
      message: 'EF015003 is type A in EC000028 but L in EC000009, using L',
    });
  });
});

describe('generateRecords', () => {
  it('generates class records and sorted value records for selected classes', () => {
    const { classes, values, issues } = generateRecords(release(), project());
    expect(classes).toEqual([
      { entity: 'etim_class', code: 'ec000009', labels: { en_US: 'Hammer set anchor', sv_SE: 'Slagankare' } },
      { entity: 'etim_class', code: 'ec000028', labels: { en_US: 'Threaded rod', sv_SE: 'Gängad stång' } },
    ]);
    expect(values.map((v) => v.code)).toEqual(['ev000072', 'ev000154', 'ev008325', 'ev008374', 'ev023258']);
    expect(values[0]).toEqual({ entity: 'etim_value', code: 'ev000072', labels: { en_US: 'Aluminium' } });
    expect(issues).toEqual([{ severity: 'warning', message: '5 etim_value records have no sv_SE label' }]);
  });

  it('only includes values of selected classes', () => {
    const { values } = generateRecords(release(), project({ classIds: ['EC000028'] }));
    expect(values.map((v) => v.code)).toEqual(['ev000072']);
  });
});
