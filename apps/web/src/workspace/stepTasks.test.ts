import { describe, expect, it } from 'vitest';
import { openTasks, stepWork, type TaskInput } from './stepTasks.js';

const input = (patch: Partial<TaskInput> = {}): TaskInput => ({
  ready: true,
  selectedClasses: 3,
  projectLocales: 2,
  metricUnits: 2,
  unmappedUnits: 1,
  features: 40,
  mappedFeatures: 30,
  skippedFeatures: 5,
  sourcesWithoutEntity: 0,
  sourceEntities: 1,
  entitiesWithoutRecords: 0,
  recordValues: 10,
  mappedRecordValues: 8,
  skippedRecordValues: 2,
  logicalSources: 0,
  logicalWithoutYes: 0,
  entityAttributes: 4,
  generatorErrors: 2,
  generatorWarnings: 0,
  akeneoSteps: ['Import 01', 'Import 02'],
  ...patch,
});

describe('stepWork', () => {
  it('marks done and open work per step', () => {
    expect(stepWork('import', input()).tasks).toEqual([{ label: 'Load an ETIM export without errors', done: true }]);
    expect(stepWork('features', input()).tasks).toEqual([{ label: 'Map ETIM units to Akeneo measurement units', done: false, detail: '1 open' }]);
    expect(stepWork('mapping', input()).tasks.map((t) => [t.done, t.detail])).toEqual([
      [false, '5 open'],
      [true, undefined],
    ]);
    expect(stepWork('records', input()).tasks).toEqual([
      { label: 'Add the records of each reference entity', done: true },
      { label: 'Fill or skip an ETIM value per record and feature', done: true, detail: '8 of 10 filled, 2 skipped' },
      { label: 'Create the record attributes on each reference entity in Akeneo', detail: '4 text attributes on 1 entity, listed on each entity' },
    ]);
    expect(stepWork('review', input()).tasks).toEqual([{ label: 'Fix all errors', done: false, detail: '2 open' }]);
  });

  it('adds the yes values of L features to the records step, also without reference entities', () => {
    expect(stepWork('records', input({ sourceEntities: 0, logicalSources: 2, logicalWithoutYes: 3 })).tasks).toEqual([
      { label: 'Tick the yes values of each L feature', done: false, detail: '3 open' },
    ]);
    expect(stepWork('records', input({ logicalSources: 1 })).tasks.at(-1)).toEqual({ label: 'Tick the yes values of each L feature', done: true });
  });

  it('has nothing open when nothing needs doing', () => {
    expect(openTasks(stepWork('features', input({ metricUnits: 0 })))).toBe(0);
    expect(openTasks(stepWork('records', input({ sourceEntities: 0 })))).toBe(0);
    expect(openTasks(stepWork('mapping', input({ mappedFeatures: 35 })))).toBe(0);
  });

  it('lists the download and the Akeneo steps on the export step, which the app cannot check', () => {
    const work = stepWork('export', input());
    expect(work.tasks).toEqual([{ label: 'Download the export' }]);
    expect(work.akeneoSteps).toEqual(['Import 01', 'Import 02']);
    expect(openTasks(work)).toBe(0);
  });

  it('waits for the generators on the review step', () => {
    expect(stepWork('review', input({ generatorErrors: undefined })).tasks).toEqual([{ label: 'Fix all errors', detail: 'checking' }]);
  });
});
