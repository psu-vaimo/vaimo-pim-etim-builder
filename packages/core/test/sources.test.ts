import { describe, expect, it } from 'vitest';
import { akeneoCodeError, normalizeSources, withSources } from '../src/index.js';

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

