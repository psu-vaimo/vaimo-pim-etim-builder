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

describe('setFeatureSources', () => {
  const set = (state: ReturnType<typeof initialState>, key: string, featureType: 'A' | 'N' | 'L' | 'R', sources: { attribute: string; second?: string; yesValues?: string[] }[]) =>
    appReducer(state, { type: 'setFeatureSources', key, featureType, sources });

  it('stores normalized sources in preference order', () => {
    const state = set(initialState(), 'EF1', 'L', [
      { attribute: ' att_a ', second: 'att_x', yesValues: [' yes ', ''] },
      { attribute: '' },
      { attribute: 'att_b' },
    ]);
    expect(state.project.features).toEqual({ EF1: { sources: [{ attribute: 'att_a', yesValues: ['yes'] }, { attribute: 'att_b' }] } });
  });

  it('keeps second only for R features', () => {
    const state = set(initialState(), 'EF2_EU1', 'R', [{ attribute: 'att_from', second: 'att_to', yesValues: ['y'] }]);
    expect(state.project.features).toEqual({ EF2_EU1: { sources: [{ attribute: 'att_from', second: 'att_to' }] } });
  });

  it('removes sources, and the entry when nothing else is left', () => {
    let state = appReducer(initialState(), { type: 'setFeatureRange', key: 'EF2_EU1', value: 'minmax-number' });
    state = set(state, 'EF2_EU1', 'R', [{ attribute: 'att_from' }]);
    state = set(state, 'EF3', 'A', [{ attribute: 'att_colour' }]);
    expect(state.project.features).toEqual({
      EF2_EU1: { range: 'minmax-number', sources: [{ attribute: 'att_from' }] },
      EF3: { sources: [{ attribute: 'att_colour' }] },
    });
    state = set(state, 'EF2_EU1', 'R', []);
    state = set(state, 'EF3', 'A', [{ attribute: '  ' }]);
    expect(state.project.features).toEqual({ EF2_EU1: { range: 'minmax-number' } });
  });

  it('keeps sources when an override is reset', () => {
    let state = set(initialState(), 'EF4_EU1', 'N', [{ attribute: 'att_w' }]);
    state = appReducer(state, { type: 'setFeatureNumeric', key: 'EF4_EU1', value: 'metric' });
    state = appReducer(state, { type: 'setFeatureNumeric', key: 'EF4_EU1', value: null });
    expect(state.project.features).toEqual({ EF4_EU1: { sources: [{ attribute: 'att_w' }] } });
  });

  it('removes the sources of unused features and keeps their overrides', () => {
    let state = set(initialState(), 'EF9', 'A', [{ attribute: 'att_old' }]);
    state = set(state, 'EF8_EU1', 'N', [{ attribute: 'att_w' }]);
    state = appReducer(state, { type: 'setFeatureNumeric', key: 'EF8_EU1', value: 'metric' });
    state = set(state, 'EF1', 'L', [{ attribute: 'att_keep' }]);
    state = appReducer(state, { type: 'removeSources', keys: ['EF9', 'EF8_EU1'] });
    expect(state.project.features).toEqual({ EF8_EU1: { numeric: 'metric' }, EF1: { sources: [{ attribute: 'att_keep' }] } });
  });
});

describe('updateSettings', () => {
  it('patches codes, groups, label words and priority, and resets naming', () => {
    let state = appReducer(initialState(), { type: 'setNumericDefault', value: 'metric' });
    state = appReducer(state, {
      type: 'updateSettings',
      patch: { codes: { attributePrefix: 'etim_' }, groups: { mapped: 'mapped' }, rulePriority: 50, labelTexts: { de_DE: { from: 'von' }, sv_SE: { min: 'Minst' } } },
    });
    const s = state.project.settings;
    expect(s.codes.attributePrefix).toBe('etim_');
    expect(s.codes.classEntity).toBe('etim_class');
    expect(s.groups).toEqual({ general: 'etim', mapped: 'mapped', unmapped: 'etim_unmapped' });
    expect(s.rulePriority).toBe(50);
    expect(s.labelTexts.de_DE).toEqual({ from: 'von', description: 'Description', min: 'Min', max: 'Max', classAttribute: 'ETIM class' });
    expect(s.labelTexts.sv_SE?.min).toBe('Minst');
    expect(s.labelTexts.sv_SE?.from).toBe('från');

    state = appReducer(state, { type: 'resetNamingSettings' });
    expect(state.project.settings.codes.attributePrefix).toBe('');
    expect(state.project.settings.labelTexts.de_DE).toBeUndefined();
    expect(state.project.settings.numeric).toBe('metric');
  });
});
