import type { EtimRelease, ParseResult } from '@akeneo-etim/core';
import { describe, expect, it } from 'vitest';
import {
  appReducer,
  classRows,
  displayLocale,
  filterClassRows,
  groupOptions,
  hasSelectedClasses,
  initialState,
  isReleaseReady,
} from './appState.js';
import { labelFor } from '@akeneo-etim/core';

const release: EtimRelease = {
  locales: ['en_US'],
  classes: {
    EC000028: { id: 'EC000028', groupId: 'EG000001', version: '5', labels: { en_US: 'Threaded rod' }, features: [] },
    EC000009: {
      id: 'EC000009',
      groupId: 'EG000002',
      version: '7',
      labels: { en_US: 'Hammer set anchor' },
      features: [{ nr: '1', featureId: 'EF1', type: 'L', sortNr: 1, valueIds: [] }],
    },
  },
  features: {},
  values: {},
  units: {},
  groups: {},
};

const ok = (r: EtimRelease): ParseResult => ({ release: r, issues: [] });

describe('appReducer', () => {
  it('loads a base import and selects its locale for the project', () => {
    const state = appReducer(initialState(), { type: 'baseImported', locale: 'en_US', fileNames: [], result: ok(release) });
    expect(state.release).toBe(release);
    expect(state.project.locales).toEqual(['en_US']);
    expect(isReleaseReady(state)).toBe(true);
    expect(displayLocale(state)).toBe('en_US');
  });

  it('is not ready when the base import has errors', () => {
    const result: ParseResult = { release, issues: [{ severity: 'error', table: 'ETIMUNIT', message: 'Missing table' }] };
    const state = appReducer(initialState(), { type: 'baseImported', locale: 'en_US', fileNames: [], result });
    expect(isReleaseReady(state)).toBe(false);
  });

  it('merges translations without errors and skips those with errors', () => {
    let state = appReducer(initialState(), { type: 'baseImported', locale: 'en_US', fileNames: [], result: ok(release) });
    const sv = { ...release, locales: ['en_US', 'sv_SE'] };
    state = appReducer(state, { type: 'translationImported', locale: 'sv_SE', fileNames: [], result: ok(sv) });
    expect(state.release).toBe(sv);
    expect(state.project.locales).toEqual(['en_US', 'sv_SE']);

    const de = { ...release, locales: ['en_US', 'sv_SE', 'de_DE'] };
    state = appReducer(state, {
      type: 'translationImported',
      locale: 'de_DE',
      fileNames: [],
      result: { release: de, issues: [{ severity: 'error', table: 'ETIMFEATURE', message: 'Missing columns' }] },
    });
    expect(state.release).toBe(sv);
    expect(state.imports.map((i) => i.applied)).toEqual([true, true, false]);
  });

  it('selects and deselects classes, sorted and unique', () => {
    let state = appReducer(initialState(), { type: 'setClassesSelected', ids: ['EC2', 'EC1', 'EC2'], selected: true });
    expect(state.project.classIds).toEqual(['EC1', 'EC2']);
    state = appReducer(state, { type: 'setClassesSelected', ids: ['EC1'], selected: false });
    expect(state.project.classIds).toEqual(['EC2']);
  });

  it('keeps project locales in release order', () => {
    let state = appReducer(initialState(), {
      type: 'baseImported',
      locale: 'en_US',
      fileNames: [],
      result: ok({ ...release, locales: ['en_US', 'sv_SE', 'de_DE'] }),
    });
    state = appReducer(state, { type: 'setProjectLocales', locales: ['de_DE', 'en_US'] });
    expect(state.project.locales).toEqual(['en_US', 'de_DE']);
  });
});

describe('feature settings', () => {
  it('sets project defaults for numeric and range', () => {
    let state = appReducer(initialState(), { type: 'setNumericDefault', value: 'metric' });
    state = appReducer(state, { type: 'setRangeDefault', value: 'minmax-number' });
    expect(state.project.settings.numeric).toBe('metric');
    expect(state.project.settings.range).toBe('minmax-number');
  });

  it('sets and removes feature overrides, dropping empty entries', () => {
    let state = appReducer(initialState(), { type: 'setFeatureNumeric', key: 'EF1_EU1', value: 'number' });
    state = appReducer(state, { type: 'setFeatureRange', key: 'EF2_EU1', value: 'text' });
    expect(state.project.features).toEqual({ EF1_EU1: { numeric: 'number' }, EF2_EU1: { range: 'text' } });
    state = appReducer(state, { type: 'setFeatureNumeric', key: 'EF1_EU1', value: null });
    expect(state.project.features).toEqual({ EF2_EU1: { range: 'text' } });
    state = appReducer(state, { type: 'setFeatureRange', key: 'EF2_EU1', value: null });
    expect(state.project.features).toEqual({});
    // Removing an override that does not exist keeps the file clean too.
    state = appReducer(state, { type: 'setFeatureRange', key: 'EF3', value: null });
    expect(state.project.features).toEqual({});
  });

  it('keeps sources when an override is removed', () => {
    let state = initialState();
    state = { ...state, project: { ...state.project, features: { EF1: { numeric: 'metric', sources: [{ attribute: 'width' }] } } } };
    state = appReducer(state, { type: 'setFeatureNumeric', key: 'EF1', value: null });
    expect(state.project.features).toEqual({ EF1: { sources: [{ attribute: 'width' }] } });
  });

  it('stores complete unit mappings only, trimmed', () => {
    let state = appReducer(initialState(), {
      type: 'setUnitMapping',
      unitId: 'EU570448',
      mapping: { family: ' Length ', unit: 'MILLIMETER' },
    });
    expect(state.project.settings.unitMap).toEqual({ EU570448: { family: 'Length', unit: 'MILLIMETER' } });
    state = appReducer(state, { type: 'setUnitMapping', unitId: 'EU570448', mapping: { family: 'Length', unit: '' } });
    expect(state.project.settings.unitMap).toEqual({});
    state = appReducer(state, { type: 'setUnitMapping', unitId: 'EU1', mapping: { family: 'Weight', unit: 'GRAM' } });
    state = appReducer(state, { type: 'setUnitMapping', unitId: 'EU1', mapping: null });
    expect(state.project.settings.unitMap).toEqual({});
  });

  it('needs a selected class from the release to leave step 2', () => {
    let state = appReducer(initialState(), { type: 'baseImported', locale: 'en_US', fileNames: [], result: ok(release) });
    expect(hasSelectedClasses(state)).toBe(false);
    state = appReducer(state, { type: 'setClassIds', ids: ['EC999999'] });
    expect(hasSelectedClasses(state)).toBe(false);
    state = appReducer(state, { type: 'setClassIds', ids: ['EC000009'] });
    expect(hasSelectedClasses(state)).toBe(true);
  });
});

describe('class rows', () => {
  it('shows group names, falling back to the id', () => {
    const withGroups = { ...release, groups: { EG000001: { id: 'EG000001', labels: { en_US: 'Fixings' } } } };
    const rows = classRows(withGroups, 'en_US');
    expect(rows.map((r) => [r.groupId, r.groupLabel])).toEqual([
      ['EG000002', ''],
      ['EG000001', 'Fixings'],
    ]);
    expect(groupOptions(rows)).toEqual([
      { value: 'EG000001', label: 'EG000001 Fixings (1)' },
      { value: 'EG000002', label: 'EG000002 (1)' },
    ]);
    expect(filterClassRows(rows, { search: 'fixings', groupId: null, selection: 'all' }, new Set()).map((r) => r.id)).toEqual([
      'EC000028',
    ]);
  });

  it('builds sorted rows and filters them', () => {
    const rows = classRows(release, 'en_US');
    expect(rows.map((r) => [r.id, r.label, r.featureCount])).toEqual([
      ['EC000009', 'Hammer set anchor', 1],
      ['EC000028', 'Threaded rod', 0],
    ]);
    const none = new Set<string>();
    expect(filterClassRows(rows, { search: 'rod thread', groupId: null, selection: 'all' }, none).map((r) => r.id)).toEqual([
      'EC000028',
    ]);
    expect(filterClassRows(rows, { search: '', groupId: 'EG000002', selection: 'all' }, none).map((r) => r.id)).toEqual([
      'EC000009',
    ]);
    const sel = new Set(['EC000009']);
    expect(filterClassRows(rows, { search: '', groupId: null, selection: 'unselected' }, sel).map((r) => r.id)).toEqual([
      'EC000028',
    ]);
  });

  it('falls back to another label', () => {
    expect(labelFor({ en_US: 'Rod' }, 'sv_SE')).toBe('Rod');
    expect(labelFor({ en_US: 'Rod', sv_SE: '' }, 'sv_SE')).toBe('Rod');
    expect(labelFor({}, 'sv_SE')).toBe('');
  });
});
