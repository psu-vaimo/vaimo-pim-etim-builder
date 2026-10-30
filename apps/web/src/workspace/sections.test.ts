import type { ProjectFeature } from '@akeneo-etim/core';
import { describe, expect, it } from 'vitest';
import {
  EXPORT_SECTION,
  SECTIONS,
  canOpen,
  clampSection,
  countMapped,
  guardReason,
  recordCounts,
  sectionStatuses,
  type StatusInput,
} from './sections.js';

const input = (patch: Partial<StatusInput> = {}): StatusInput => ({
  ready: true,
  hasClasses: true,
  imported: true,
  importErrors: 0,
  localeCount: 2,
  selectedClasses: 3,
  features: 40,
  mappedFeatures: 5,
  generatorErrors: 0,
  generatorWarnings: 0,
  sourceEntities: 1,
  recordValues: 10,
  mappedRecordValues: 4,
  ...patch,
});

describe('sections', () => {
  it('lists the wizard steps in order, Export last', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['import', 'classes', 'features', 'mapping', 'records', 'review', 'export']);
    expect(EXPORT_SECTION).toBe(6);
  });

  it('clamps indexes to existing sections', () => {
    expect(clampSection(-1)).toBe(0);
    expect(clampSection(9)).toBe(6);
    expect(clampSection(2.5)).toBe(0);
    expect(clampSection(3)).toBe(3);
  });
});

describe('guardReason', () => {
  it('always allows Import', () => {
    expect(guardReason(0, { ready: false, hasClasses: false })).toBeUndefined();
  });

  it('needs a ready release after Import', () => {
    for (let i = 1; i < SECTIONS.length; i++) {
      expect(guardReason(i, { ready: false, hasClasses: true })).toBe('Import an ETIM export without errors first');
    }
  });

  it('needs a selected class after Classes', () => {
    expect(guardReason(1, { ready: true, hasClasses: false })).toBeUndefined();
    for (let i = 2; i < SECTIONS.length; i++) {
      expect(guardReason(i, { ready: true, hasClasses: false })).toBe('Select at least one class first');
    }
  });

  it('allows everything with a ready release and a class', () => {
    expect(SECTIONS.every((_, i) => canOpen(i, { ready: true, hasClasses: true }))).toBe(true);
    expect(canOpen(7, { ready: true, hasClasses: true })).toBe(false);
    expect(canOpen(-1, { ready: true, hasClasses: true })).toBe(false);
  });
});

describe('sectionStatuses', () => {
  const texts = (s: StatusInput) => sectionStatuses(s).map((x) => x.text);

  it('shows counts when everything is open', () => {
    expect(texts(input())).toEqual(['Ready, 2 locales', '3 selected', '40 features', '5 of 40 mapped', '4 of 10 values mapped', 'No errors', 'Ready']);
  });

  it('shows the guard reason for blocked sections', () => {
    const s = sectionStatuses(input({ ready: false, hasClasses: false, imported: false }));
    expect(s[0]).toEqual({ text: 'No ETIM export yet', tone: 'muted' });
    expect(s.slice(1).every((x) => x.text === 'Import an ETIM export without errors first' && x.tone === 'muted')).toBe(true);
  });

  it('reports import errors', () => {
    expect(sectionStatuses(input({ ready: false, importErrors: 2 }))[0]).toEqual({ text: '2 import errors', tone: 'error' });
    expect(sectionStatuses(input({ ready: false, importErrors: 1 }))[0]?.text).toBe('1 import error');
  });

  it('asks for a class once the release is ready', () => {
    const s = texts(input({ hasClasses: false, selectedClasses: 0 }));
    expect(s.slice(0, 3)).toEqual(['Ready, 2 locales', 'None selected', 'Select at least one class first']);
  });

  it('shows generator errors and warnings in Review and Export', () => {
    const s = sectionStatuses(input({ generatorErrors: 1, generatorWarnings: 4 }));
    expect(s[5]).toEqual({ text: '1 error, 4 warnings', tone: 'error' });
    expect(s[6]).toEqual({ text: 'Ready, 1 error to check', tone: 'warning' });
    expect(sectionStatuses(input({ generatorWarnings: 1 }))[5]).toEqual({ text: 'No errors, 1 warning', tone: 'warning' });
    expect(sectionStatuses(input({ generatorErrors: 3 }))[5]?.text).toBe('3 errors');
  });

  it('waits while the generators have not run', () => {
    const s = texts(input({ generatorErrors: undefined, generatorWarnings: undefined }));
    expect(s[5]).toBe('Checking...');
    expect(s[6]).toBe('Checking...');
  });

  it('uses singular words and thousands separators', () => {
    const s = texts(input({ localeCount: 1, features: 1, mappedFeatures: 0 }));
    expect(s[0]).toBe('Ready, 1 locale');
    expect(s[2]).toBe('1 feature');
    expect(texts(input({ features: 1234 }))[2]).toBe('1,234 features');
  });

  it('never uses dashes or semicolons in copy', () => {
    const all = [
      ...texts(input()),
      ...texts(input({ ready: false, hasClasses: false })),
      ...texts(input({ generatorErrors: 2, generatorWarnings: 2 })),
    ];
    expect(all.join(' ')).not.toMatch(/[–—;]/);
  });
});

describe('records status', () => {
  const status = (patch: Partial<StatusInput>) => sectionStatuses(input(patch))[4];

  it('shows mapped record values, muted without entities and a warning without records', () => {
    expect(status({ sourceEntities: 0, recordValues: 0, mappedRecordValues: 0 })).toEqual({ text: 'No reference entity sources', tone: 'muted' });
    expect(status({ sourceEntities: 2, recordValues: 0, mappedRecordValues: 0 })).toEqual({ text: '2 entities, no records', tone: 'warning' });
    expect(status({ recordValues: 6, mappedRecordValues: 6 })).toEqual({ text: '6 of 6 values mapped', tone: 'ok' });
  });

  it('counts record values per entity', () => {
    const plan = (records: Record<string, string>[], features: string[]) => ({
      code: 'x',
      attributes: ['att'],
      features: features.map((featureId) => ({ key: featureId, featureId, attribute: 'att', valueIds: [], classIds: [], classValueIds: {}, exceptionClassIds: [] })),
      records: records.map((values, i) => ({ code: `r${i}`, labels: {}, values })),
    });
    expect(recordCounts([plan([{ EF1: 'EV1' }, {}], ['EF1', 'EF2']), plan([], ['EF3'])])).toEqual({
      sourceEntities: 2,
      recordValues: 4,
      mappedRecordValues: 1,
    });
  });
});

describe('countMapped', () => {
  const f = (key: string): ProjectFeature => ({ key, featureId: key, type: 'A', classIds: ['EC1'] });

  it('counts selected features with sources only', () => {
    const features = [f('EF1'), f('EF2'), f('EF3')];
    const config = {
      EF1: { sources: [{ attribute: 'att_a' }] },
      EF2: { numeric: 'metric' as const },
      EF9: { sources: [{ attribute: 'att_b' }] },
    };
    expect(countMapped(features, config)).toBe(1);
  });
});
