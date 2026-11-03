import { describe, expect, it } from 'vitest';
import { release, project } from '../test/release.js';
import { generateModel, memoizeLast } from './generated.js';
import {
  attributeReviewRows,
  countAttributeTypes,
  dependencyReviewRows,
  filterBySearch,
  paginate,
  recordReviewRows,
  ruleReviewRows,
  sourceEntitySummaries,
  sourceRecordReviewRows,
  truncateList,
} from './reviewRows.js';
import { buildExport } from '@vaimo-pim-etim-builder/core';

const mapped = project({ features: { EF000139: { sources: [{ attribute: 'att_surface_treatment' }] } } });

describe('generateModel', () => {
  it('runs all generators with the same issues as buildExport', () => {
    const model = generateModel(release, mapped);
    expect(model.attributes.map((a) => a.code)).toEqual(['etim_class', 'ef000008_eu570448', 'ef000139', 'ef000139_label', 'ef015003']);
    expect(model.classRecords.map((r) => r.code)).toEqual(['ec000009']);
    expect(model.valueRecords.map((r) => r.code)).toEqual(['ev000072', 'ev000154']);
    expect(model.rules.map((r) => r.code)).toEqual(['etim_att_surface_treatment']);
    expect(model.dependencies.map((d) => d.code)).toEqual(['etim_ec000009']);
    expect(model.issues).toEqual(buildExport(release, mapped).issues);
  });

  it('memoizeLast reuses the result for the same arguments only', () => {
    let calls = 0;
    const fn = memoizeLast((a: object, b: object) => ({ a, b, n: ++calls }));
    const a = {};
    const b = {};
    expect(fn(a, b)).toBe(fn(a, b));
    expect(calls).toBe(1);
    fn(a, {});
    expect(calls).toBe(2);
  });
});

describe('review rows', () => {
  const model = generateModel(release, mapped);

  it('counts attribute types', () => {
    expect(countAttributeTypes(model.attributes)).toEqual([
      ['akeneo_reference_entity', 1],
      ['pim_catalog_number', 1],
      ['pim_catalog_text', 2],
      ['pim_catalog_boolean', 1],
    ]);
  });

  it('searches attributes by code, label and feature', () => {
    const rows = attributeReviewRows(model.attributes);
    expect(rows[0]?.feature).toBe('');
    expect(filterBySearch(rows, 'bredd').map((r) => r.attribute.code)).toEqual(['ef000008_eu570448']);
    expect(filterBySearch(rows, 'EF000139 label').map((r) => r.attribute.code)).toEqual(['ef000139_label']);
    expect(filterBySearch(rows, '  ')).toHaveLength(rows.length);
  });

  it('formats rules', () => {
    const [row] = ruleReviewRows(model.rules, 'en_US');
    expect(row?.conditions).toEqual(['etim_class NOT EMPTY', 'att_surface_treatment NOT EMPTY']);
    expect(row?.actions[0]).toBe('copy att_surface_treatment (ref_ef000139) to ef000139');
    expect(row?.label).toBe('ETIM (from: att_surface_treatment)');
  });

  it('counts shown and restricted attributes per dependency', () => {
    const unmapped = generateModel(release, project());
    const [row] = dependencyReviewRows(unmapped.dependencies, 'sv_SE');
    expect(row?.trigger).toBe('etim_class IN [ec000009]');
    expect(row?.shown).toBe(3);
    expect(row?.restricted).toBe(1);
    expect(row?.label).toBe('EC000009 - Slagankare');
    expect(filterBySearch(dependencyReviewRows(unmapped.dependencies, 'en_US'), 'ef015003')).toHaveLength(1);
  });

  it('searches records by label', () => {
    expect(filterBySearch(recordReviewRows(model.valueRecords), 'zinc ev000154')).toHaveLength(0);
    expect(filterBySearch(recordReviewRows(model.valueRecords), 'förzinkad').map((r) => r.record.code)).toEqual(['ev000072']);
  });
});

describe('source record rows', () => {
  const withRecords = project({
    features: { EF000139: { sources: [{ attribute: 'att_surface_treatment' }] } },
    sourceEntityLinks: { att_surface_treatment: 'surface' },
    sourceEntities: [
      {
        code: 'surface',
        records: [
          { code: 'zinc', labels: { en_US: 'Zinc' }, values: { EF000139: 'EV000072' }, classValues: { EC000009: { EF000139: 'EV000154' } } },
          { code: 'raw', labels: {}, values: {} },
        ],
      },
    ],
  });
  const model = generateModel(release, withRecords);

  it('summarizes each source entity', () => {
    expect(sourceEntitySummaries(release, withRecords, model.sourceEntities, 'en_US')).toEqual([
      {
        code: 'surface',
        attributes: ['att_surface_treatment'],
        records: 2,
        features: [{ featureId: 'EF000139', label: 'Surface protection', filled: 2, defaults: 1, skipped: 0, exceptionClasses: ['EC000009'] }],
        recordAttributes: ['ref_ef000139', 'ref_ef000139_label', 'ref_ef000139_ec000009', 'ref_ef000139_ec000009_label'],
        labelSuffix: '_label',
      },
    ]);
  });

  it('lists record values with class exceptions, searchable', () => {
    const rows = sourceRecordReviewRows(release, model.sourceEntities[0]!, 'en_US');
    expect(rows[0]?.cells).toEqual([
      { featureId: 'EF000139', value: 'EV000072 - Zinc plated', skipped: false, classValues: [{ classId: 'EC000009', value: 'EV000154 - Other' }] },
    ]);
    expect(rows[1]?.cells[0]?.value).toBeUndefined();
    expect(filterBySearch(rows, 'other ec000009').map((r) => r.record.code)).toEqual(['zinc']);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 120 }, (_, i) => i);
  it('slices pages and clamps the page number', () => {
    expect(paginate(items, 1, 50)).toMatchObject({ page: 1, totalPages: 3, start: 0 });
    expect(paginate(items, 3, 50).rows).toHaveLength(20);
    expect(paginate(items, 9, 50).page).toBe(3);
    expect(paginate([], 2, 50)).toMatchObject({ page: 1, totalPages: 1, rows: [] });
  });
  it('truncates lists', () => {
    expect(truncateList([1, 2, 3], 2)).toEqual({ shown: [1, 2], more: 1 });
    expect(truncateList([1], 2)).toEqual({ shown: [1], more: 0 });
  });
});
