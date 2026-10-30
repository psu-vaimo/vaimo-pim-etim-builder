import { describe, expect, it } from 'vitest';
import { akeneoCodeError, applySourceEntityLinks, applySourceMappings, createProject, normalizeSources, withSources } from '../src/index.js';

const draft = (attribute: string, second = '', yesValues: string[] = []) => ({ attribute, second, yesValues });

describe('akeneoCodeError', () => {
  it('accepts letters, digits and underscores up to 100 characters', () => {
    expect(akeneoCodeError('att_Surface_1')).toBeUndefined();
    expect(akeneoCodeError('')).toBe('Code is empty');
    expect(akeneoCodeError('att-x')).toBe('Use only letters, digits and underscores');
    expect(akeneoCodeError('a'.repeat(101))).toBe('At most 100 characters');
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


describe('applySourceMappings', () => {
  const project = {
    ...createProject('Test'),
    features: { EF000001: { sources: [{ attribute: 'old' }] }, EF000008_EU570448: { numeric: 'metric' as const } },
  };

  it('sets, replaces and removes sources by feature and unit', () => {
    const result = applySourceMappings(project, [
      { featureId: 'ef000008', unitId: 'eu570448', type: 'N', attribute: ' att_width ' },
      { featureId: 'EF000001', type: 'A', attribute: '' },
      { featureId: 'EF000002', type: 'L', attribute: 'att_ok', yesValues: ['yes'], second: 'ignored' },
      { featureId: 'EF000003', type: 'R', attribute: 'att_min', second: 'att_max' },
    ]);
    expect(result).toEqual({
      ok: true,
      project: {
        ...project,
        features: {
          EF000008_EU570448: { numeric: 'metric', sources: [{ attribute: 'att_width' }] },
          EF000002: { sources: [{ attribute: 'att_ok', yesValues: ['yes'] }] },
          EF000003: { sources: [{ attribute: 'att_min', second: 'att_max' }] },
        },
      },
    });
    expect(project.features.EF000001).toEqual({ sources: [{ attribute: 'old' }] });
  });

  it('rejects invalid codes and duplicate features without applying anything', () => {
    expect(
      applySourceMappings(project, [
        { featureId: 'EF000003', type: 'R', attribute: 'att-a', second: 'att b' },
        { featureId: 'EF000001', type: 'N', attribute: 'a' },
        { featureId: 'ef000001', type: 'N', attribute: 'b' },
      ]),
    ).toEqual({
      ok: false,
      errors: [
        'EF000003: attribute "att-a": Use only letters, digits and underscores',
        'EF000003: second "att b": Use only letters, digits and underscores',
        'EF000001: listed more than once, a feature has at most one source',
      ],
    });
  });
});

describe('applySourceEntityLinks', () => {
  const project = { ...createProject('Test'), sourceEntityLinks: { att_a: 'old', att_b: 'keep' } };

  it('sets, replaces and removes links', () => {
    const result = applySourceEntityLinks(project, [
      { attribute: ' att_a ', entity: ' fastening ' },
      { attribute: 'att_c', entity: 'colour' },
      { attribute: 'att_b', entity: '' },
    ]);
    expect(result.ok && result.project.sourceEntityLinks).toEqual({ att_a: 'fastening', att_c: 'colour' });
    const none = applySourceEntityLinks(project, [{ attribute: 'att_a', entity: '' }, { attribute: 'att_b', entity: '' }]);
    expect(none.ok && 'sourceEntityLinks' in none.project).toBe(false);
  });

  it('rejects invalid codes and duplicate attributes', () => {
    expect(
      applySourceEntityLinks(project, [
        { attribute: 'att-a', entity: 'x' },
        { attribute: 'att_c', entity: 'a b' },
        { attribute: 'att_c', entity: 'y' },
      ]),
    ).toEqual({
      ok: false,
      errors: [
        'Attribute "att-a": Use only letters, digits and underscores',
        'Attribute att_c: reference entity "a b": Use only letters, digits and underscores',
        'Attribute att_c: listed more than once',
      ],
    });
  });
});
