import type { AkeneoRule, ProjectFeature } from '@akeneo-etim/core';
import { describe, expect, it } from 'vitest';
import type { FeatureRow } from '../features/featureRows.js';
import {
  codeError,
  filterMappingRows,
  formatAction,
  formatSource,
  mappingRows,
  moveItem,
  normalizeSources,
  orphanMappings,
  ruleConditions,
  toDrafts,
  validateDrafts,
  withSources,
} from './sourceMappings.js';

const draft = (attribute: string, second = '', yesValues: string[] = []) => ({ attribute, second, yesValues });

describe('codeError', () => {
  it('accepts Akeneo codes and empty input, rejects other characters and long codes', () => {
    expect(codeError('att_Surface_1')).toBeUndefined();
    expect(codeError('  att_a  ')).toBeUndefined();
    expect(codeError('')).toBeUndefined();
    expect(codeError('att a')).toBe('Use only letters, digits and underscores');
    expect(codeError('att-a')).toBe('Use only letters, digits and underscores');
    expect(codeError('x'.repeat(101))).toBe('At most 100 characters');
  });
});

describe('validateDrafts', () => {
  it('flags invalid codes, duplicates and a second source without a first', () => {
    expect(validateDrafts([draft('att a'), draft('att_b'), draft('att_b'), draft('')], 'N')).toEqual([
      { attribute: 'Use only letters, digits and underscores' },
      {},
      { attribute: 'att_b is already listed' },
      {},
    ]);
    expect(validateDrafts([draft('', 'att_to'), draft('att_from', 'att to')], 'R')).toEqual([
      { attribute: 'Enter the first source too' },
      { second: 'Use only letters, digits and underscores' },
    ]);
  });

  it('ignores second for non R features', () => {
    expect(validateDrafts([draft('att_a', 'bad code')], 'N')).toEqual([{}]);
  });
});

describe('normalizeSources', () => {
  it('trims, drops empty sources and keeps second only for R and yes values only for L', () => {
    const input = [draft(' att_a ', ' att_b ', [' yes ', '', 'yes', 'ja']), draft('  '), draft('att_c', '  ')];
    expect(normalizeSources(input, 'R')).toEqual([{ attribute: 'att_a', second: 'att_b' }, { attribute: 'att_c' }]);
    expect(normalizeSources(input, 'L')).toEqual([{ attribute: 'att_a', yesValues: ['yes', 'ja'] }, { attribute: 'att_c' }]);
    expect(normalizeSources(input, 'A')).toEqual([{ attribute: 'att_a' }, { attribute: 'att_c' }]);
    expect(normalizeSources([{ attribute: 'att_a', yesValues: [' '] }], 'L')).toEqual([{ attribute: 'att_a' }]);
  });

  it('round trips through drafts', () => {
    const sources = [{ attribute: 'att_a', second: 'att_b' }, { attribute: 'att_c' }];
    expect(normalizeSources(toDrafts(sources), 'R')).toEqual(sources);
  });
});

describe('withSources', () => {
  it('replaces sources and keeps other fields, leaves sources out when empty', () => {
    expect(withSources({ range: 'text', sources: [{ attribute: 'a' }] }, [{ attribute: 'b' }])).toEqual({
      range: 'text',
      sources: [{ attribute: 'b' }],
    });
    expect(withSources({ range: 'text', sources: [{ attribute: 'a' }] }, [])).toEqual({ range: 'text' });
    expect(withSources(undefined, [])).toEqual({});
  });
});

describe('moveItem', () => {
  it('moves an item and ignores out of range moves', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
  });
});

describe('rule formatting', () => {
  it('formats actions', () => {
    expect(formatAction({ type: 'copy', from_field: 'att_x', to_field: 'ef000139', reference_entity_attribute: 'etim_value' })).toBe(
      'copy att_x (etim_value) to ef000139',
    );
    expect(formatAction({ type: 'copy', from_field: 'att_x', to_field: 'ef1' })).toBe('copy att_x to ef1');
    expect(formatAction({ type: 'set', field: 'ef015003', value: false })).toBe('set ef015003 to false');
    expect(
      formatAction({ type: 'concatenate', from: [{ field: 'att_a' }, { text: '-' }, { field: 'att_b' }], to: { field: 'ef1' } }),
    ).toBe('concatenate att_a + "-" + att_b to ef1');
  });

  it('formats conditions', () => {
    const rule = {
      conditions: [
        {
          operator: 'AND',
          value: [
            { field: 'etim_class', operator: 'NOT EMPTY' },
            { field: 'att_p', operator: 'NOT IN', value: ['yes', 'ja'] },
          ],
        },
      ],
    } as unknown as AkeneoRule;
    expect(ruleConditions(rule)).toEqual(['etim_class NOT EMPTY', 'att_p NOT IN [yes, ja]']);
  });

  it('summarises sources', () => {
    expect(formatSource({ attribute: 'att_a' })).toBe('att_a');
    expect(formatSource({ attribute: 'att_a', second: 'att_b' })).toBe('att_a + att_b');
    expect(formatSource({ attribute: 'att_a', yesValues: ['y', 'ja'] })).toBe('att_a (yes: y, ja)');
  });
});

describe('mapping rows', () => {
  const row = (key: string, type: FeatureRow['type']): FeatureRow => ({
    key,
    featureId: key,
    label: key,
    type,
    unitId: undefined,
    unitLabel: '',
    classCount: 1,
    attributes: [],
    searchText: key.toLowerCase(),
  });
  const features: ProjectFeature[] = [
    { key: 'EF1', featureId: 'EF1', type: 'A', classIds: ['EC2', 'EC1'] },
    { key: 'EF2', featureId: 'EF2', type: 'N', classIds: ['EC1'] },
  ];
  const rows = mappingRows([row('EF1', 'A'), row('EF2', 'N')], features, {
    EF1: { sources: [{ attribute: 'att_colour' }] },
    EF2: { numeric: 'metric' },
    EF9: { sources: [{ attribute: 'att_gone' }] },
  });

  it('adds sources and the first class', () => {
    expect(rows.map((r) => [r.key, r.firstClassId, r.sources])).toEqual([
      ['EF1', 'EC2', [{ attribute: 'att_colour' }]],
      ['EF2', 'EC1', []],
    ]);
  });

  it('filters by mapped status, type and source code', () => {
    const keys = (f: Parameters<typeof filterMappingRows>[1]) => filterMappingRows(rows, f).map((r) => r.key);
    expect(keys({ search: '', type: null, mapped: 'mapped' })).toEqual(['EF1']);
    expect(keys({ search: '', type: null, mapped: 'unmapped' })).toEqual(['EF2']);
    expect(keys({ search: '', type: 'N', mapped: 'all' })).toEqual(['EF2']);
    expect(keys({ search: 'COLOUR', type: null, mapped: 'all' })).toEqual(['EF1']);
  });

  it('lists mappings of features outside the selected classes', () => {
    expect(orphanMappings(features, { EF1: { sources: [{ attribute: 'a' }] }, EF9: { sources: [{ attribute: 'b' }] }, EF8: { range: 'text' } })).toEqual([
      'EF9',
    ]);
  });
});
