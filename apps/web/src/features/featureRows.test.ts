import { collectProjectFeatures, createProject, generateAttributes, type EtimRelease, type Project } from '@akeneo-etim/core';
import { describe, expect, it } from 'vitest';
import {
  countBy,
  effectiveNumeric,
  effectiveRange,
  featureRows,
  filterFeatureRows,
  metricUnitRows,
  resolvesToMetric,
  suggestUnitMapping,
  unitSuggestions,
} from './featureRows.js';

const release: EtimRelease = {
  locales: ['en_US', 'sv_SE'],
  classes: {
    EC1: {
      id: 'EC1',
      groupId: 'EG1',
      version: '1',
      labels: { en_US: 'Anchor' },
      features: [
        { nr: '1', featureId: 'EF1', type: 'N', unitId: 'EU1', sortNr: 1, valueIds: [] },
        { nr: '2', featureId: 'EF2', type: 'A', sortNr: 2, valueIds: [] },
        { nr: '3', featureId: 'EF3', type: 'R', unitId: 'EU2', sortNr: 3, valueIds: [] },
      ],
    },
    EC2: {
      id: 'EC2',
      groupId: 'EG1',
      version: '1',
      labels: { en_US: 'Rod' },
      features: [{ nr: '4', featureId: 'EF1', type: 'N', unitId: 'EU1', sortNr: 1, valueIds: [] }],
    },
  },
  features: {
    EF1: { id: 'EF1', labels: { en_US: 'Width', sv_SE: 'Bredd' } },
    EF2: { id: 'EF2', labels: { en_US: 'Colour' } },
    EF3: { id: 'EF3', labels: { en_US: 'Voltage range' } },
  },
  values: {},
  units: { EU1: { id: 'EU1', labels: { en_US: 'mm' } }, EU2: { id: 'EU2', labels: { en_US: 'V' } } },
  groups: {},
};

function project(patch: Partial<Project> = {}): Project {
  return { ...createProject('p', ['en_US']), classIds: ['EC1', 'EC2'], ...patch };
}

describe('feature rows', () => {
  it('builds rows with labels, class counts and attributes', () => {
    const p = project();
    const { features } = collectProjectFeatures(release, p);
    const { attributes } = generateAttributes(release, p);
    const rows = featureRows(release, features, attributes, 'sv_SE');
    expect(rows.map((r) => [r.key, r.label, r.unitLabel, r.classCount, r.attributes.map((a) => `${a.code}:${a.type}`)])).toEqual([
      ['EF1_EU1', 'Bredd', 'mm', 2, ['ef1_eu1:pim_catalog_number']],
      ['EF2', 'Colour', '', 1, ['ef2:akeneo_reference_entity']],
      ['EF3_EU2', 'Voltage range', 'V', 1, ['ef3_eu2:pim_catalog_text']],
    ]);
    expect(filterFeatureRows(rows, { search: 'width', type: null }).map((r) => r.key)).toEqual(['EF1_EU1']);
    expect(filterFeatureRows(rows, { search: 'ef3_eu2', type: null }).map((r) => r.key)).toEqual(['EF3_EU2']);
    expect(filterFeatureRows(rows, { search: '', type: 'A' }).map((r) => r.key)).toEqual(['EF2']);
    expect(countBy(rows, (r) => r.type)).toEqual({ N: 1, A: 1, R: 1 });
  });

  it('resolves overrides over project defaults', () => {
    const p = project({
      settings: { ...createProject('').settings, numeric: 'metric', range: 'minmax-metric' },
      features: { EF1_EU1: { numeric: 'number' } },
    });
    expect(effectiveNumeric(p, 'EF1_EU1')).toBe('number');
    expect(effectiveNumeric(p, 'EF9')).toBe('metric');
    expect(effectiveRange(p, 'EF3_EU2')).toBe('minmax-metric');
    const { features } = collectProjectFeatures(release, p);
    expect(features.map((f) => resolvesToMetric(f, p))).toEqual([false, false, true]);
  });

  it('lists units of metric features and flags missing mappings', () => {
    const settings = { ...createProject('').settings, numeric: 'metric' as const, range: 'minmax-metric' as const };
    let p = project({ settings });
    const { features } = collectProjectFeatures(release, p);
    expect(metricUnitRows(release, features, p, 'en_US')).toEqual([
      { unitId: 'EU1', label: 'mm', featureKeys: ['EF1_EU1'], mapped: false },
      { unitId: 'EU2', label: 'V', featureKeys: ['EF3_EU2'], mapped: false },
    ]);
    p = project({ settings: { ...settings, range: 'text', unitMap: { EU1: { family: 'Length', unit: 'MILLIMETER' } } } });
    expect(metricUnitRows(release, features, p, 'en_US')).toEqual([
      { unitId: 'EU1', label: 'mm', featureKeys: ['EF1_EU1'], mapped: true },
    ]);
  });

  it('suggests mappings for common unit symbols', () => {
    expect(suggestUnitMapping(['mm'])).toEqual({ family: 'Length', unit: 'MILLIMETER' });
    expect(suggestUnitMapping(['xyz', '°C'])).toEqual({ family: 'Temperature', unit: 'CELSIUS' });
    expect(suggestUnitMapping(['lux'])).toBeUndefined();
    expect(unitSuggestions('Weight')).toEqual(['KILOGRAM', 'GRAM']);
    expect(unitSuggestions('Custom')).toContain('VOLT');
  });
});
