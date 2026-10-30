import { describe, expect, it } from 'vitest';
import { planEtimReload } from './importLibrary.js';
import type { EtimLibrary } from './library.js';

const en = { locale: 'en_US', files: ['ETIMARTCLASS.csv'] };
const sv = { locale: 'sv_SE', files: ['ETIMARTCLASS.csv'] };
const library: EtimLibrary = { releases: [{ name: 'ETIM-10.0', locales: [en, sv] }] };

describe('planEtimReload', () => {
  it('imports a pre-loaded release with its languages', () => {
    expect(planEtimReload({ library: 'ETIM-10.0', locales: ['en_US', 'sv_SE', 'de_DE'] }, undefined, library)).toEqual({
      kind: 'library',
      release: 'ETIM-10.0',
      base: en,
      translations: [sv],
      missing: ['de_DE'],
    });
  });

  it('does nothing when the file has no source or the same export is loaded', () => {
    expect(planEtimReload(undefined, undefined, library)).toEqual({ kind: 'none' });
    const source = { library: 'ETIM-10.0', locales: ['en_US', 'sv_SE'] };
    expect(planEtimReload(source, { ...source }, library)).toEqual({ kind: 'none' });
    expect(planEtimReload(source, { library: 'ETIM-10.0', locales: ['en_US'] }, library).kind).toBe('library');
  });

  it('asks for a manual import for uploads and releases the library does not have', () => {
    expect(planEtimReload({ locales: ['en_US'] }, undefined, library)).toMatchObject({ kind: 'manual', reason: expect.stringContaining('uploaded') });
    expect(planEtimReload({ library: 'ETIM-9.0', locales: ['en_US'] }, undefined, library)).toMatchObject({ kind: 'manual', reason: expect.stringContaining('ETIM-9.0') });
    expect(planEtimReload({ library: 'ETIM-10.0', locales: ['de_DE'] }, undefined, library).kind).toBe('manual');
  });
});
