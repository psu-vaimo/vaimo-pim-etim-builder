import { normalizeSources, type AkeneoRule, type ProjectFeature } from '@akeneo-etim/core';
import { describe, expect, it } from 'vitest';
import type { FeatureRow } from '../features/featureRows.js';
import {
  codeError,
  draftsDiffer,
  filterMappingRows,
  formatAction,
  formatSource,
  groupBySource,
  mappingRows,
  orphanMappings,
  pageGroups,
  ruleConditions,
  toDrafts,
  validateDrafts,
  withoutSources,
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
  it('flags invalid codes, more than one source and a second source without a first', () => {
    expect(validateDrafts([draft('att a'), draft('att_b'), draft('att_c'), draft('')], 'N')).toEqual([
      { attribute: 'Use only letters, digits and underscores' },
      { attribute: 'Only one source per feature, remove this one' },
      { attribute: 'Only one source per feature, remove this one' },
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

describe('normalizeSources with drafts', () => {
  it('round trips through drafts', () => {
    const sources = [{ attribute: 'att_a', second: 'att_b' }, { attribute: 'att_c' }];
    expect(normalizeSources(toDrafts(sources), 'R')).toEqual(sources);
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

  it('groups by first and second source, unmapped last, and pages whole groups', () => {
    const grouped = mappingRows([row('EF1', 'A'), row('EF2', 'R'), row('EF3', 'N'), row('EF4', 'N')], features, {
      EF1: { sources: [{ attribute: 'att_colour' }] },
      EF2: { sources: [{ attribute: 'att_min', second: 'att_colour' }] },
      EF3: { sources: [{ attribute: 'att_colour', second: 'att_colour' }] },
    });
    const groups = groupBySource(grouped);
    expect(groups.map((g) => [g.source, g.rows.map((r) => r.key)])).toEqual([
      ['att_colour', ['EF1', 'EF2', 'EF3']],
      ['att_min', ['EF2']],
      [null, ['EF4']],
    ]);
    expect(pageGroups(groups, 2).map((p) => p.map((g) => g.source))).toEqual([['att_colour'], ['att_min', null]]);
    expect(pageGroups([], 2)).toEqual([]);
  });

  it('lists mappings of features outside the selected classes', () => {
    expect(orphanMappings(features, { EF1: { sources: [{ attribute: 'a' }] }, EF9: { sources: [{ attribute: 'b' }] }, EF8: { range: 'text' } })).toEqual([
      'EF9',
    ]);
  });
});

describe('draftsDiffer', () => {
  const saved = [{ attribute: 'att_a' }, { attribute: 'att_b', second: 'att_c' }];
  it('ignores whitespace, empty rows and fields the type does not use', () => {
    expect(draftsDiffer(toDrafts(saved), saved, 'R')).toBe(false);
    expect(draftsDiffer([draft(' att_a '), draft(''), draft('att_b', 'att_c ')], saved, 'R')).toBe(false);
    expect(draftsDiffer([draft('att_a', 'x')], [{ attribute: 'att_a' }], 'N')).toBe(false);
    expect(draftsDiffer([draft('')], [], 'A')).toBe(false);
  });
  it('sees changed codes, order and yes values', () => {
    expect(draftsDiffer([draft('att_b', 'att_c'), draft('att_a')], saved, 'R')).toBe(true);
    expect(draftsDiffer([draft('att_a')], saved, 'R')).toBe(true);
    expect(draftsDiffer([draft('att_x')], [], 'A')).toBe(true);
    expect(draftsDiffer([draft('att_l', '', ['yes'])], [{ attribute: 'att_l' }], 'L')).toBe(true);
  });
});

describe('withoutSources', () => {
  it('removes only sources and drops entries left empty', () => {
    const config = {
      EF1: { sources: [{ attribute: 'a' }] },
      EF2_EU1: { numeric: 'metric' as const, sources: [{ attribute: 'b' }] },
      EF3: { sources: [{ attribute: 'c' }] },
      EF4: { range: 'text' as const },
    };
    expect(withoutSources(config, ['EF1', 'EF2_EU1', 'EF4'])).toEqual({
      EF2_EU1: { numeric: 'metric' },
      EF3: { sources: [{ attribute: 'c' }] },
      EF4: { range: 'text' },
    });
    expect(withoutSources(config, [])).toEqual(config);
  });
});
