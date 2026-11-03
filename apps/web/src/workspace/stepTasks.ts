import { SUB_STEPS, type SectionId } from './sections.js';

/** Work the consultant must do by hand on a step. `done` is left out for work the app cannot check, such as the download. */
export interface StepTask {
  /** Number of the part of the step the task belongs to, `2.1`, shown in front of the label. Left out on steps without parts. */
  subStep?: string;
  label: string;
  done?: boolean;
  /** Short count, `12 open`. */
  detail?: string;
}

export interface StepWork {
  tasks: StepTask[];
  /** Steps in Akeneo after the export, in order. Only on the export step. */
  akeneoSteps: string[];
}

export interface TaskInput {
  /** Base import loaded without errors. */
  ready: boolean;
  selectedClasses: number;
  projectLocales: number;
  /** ETIM units of metric attributes, and how many have no Akeneo measurement unit. */
  metricUnits: number;
  unmappedUnits: number;
  features: number;
  mappedFeatures: number;
  skippedFeatures: number;
  /** Sources of A features without a reference entity. */
  sourcesWithoutEntity: number;
  sourceEntities: number;
  entitiesWithoutRecords: number;
  recordValues: number;
  mappedRecordValues: number;
  skippedRecordValues: number;
  /** Source attributes providing L features, and the L features of non Yes/No sources without yes values. */
  logicalSources: number;
  logicalWithoutYes: number;
  /** `ref_` text attributes the reference entities need in Akeneo, label attributes included. */
  entityAttributes: number;
  /** Generator errors, `undefined` while generating. */
  generatorErrors: number | undefined;
  generatorWarnings: number | undefined;
  akeneoSteps: readonly string[];
}

const count = (n: number) => n.toLocaleString('en-US');

/** The manual work of one step, what is done and what is still open. */
export function stepWork(id: SectionId, s: TaskInput): StepWork {
  const work = (tasks: StepTask[], akeneoSteps: string[] = []): StepWork => ({ tasks, akeneoSteps });
  switch (id) {
    case 'import':
      return work([{ subStep: SUB_STEPS.etimVersion.number, label: 'Load an ETIM export without errors', done: s.ready }]);
    case 'classes':
      return work([
        { subStep: SUB_STEPS.locales.number, label: 'Pick the project locales', done: s.projectLocales > 0, detail: `${count(s.projectLocales)} selected` },
        {
          subStep: SUB_STEPS.classes.number,
          label: "Select the client's ETIM classes",
          done: s.selectedClasses > 0,
          detail: `${count(s.selectedClasses)} selected`,
        },
      ]);
    case 'features':
      return work([
        s.metricUnits === 0
          ? { subStep: SUB_STEPS.units.number, label: 'Map ETIM units to Akeneo measurement units', done: true, detail: 'no metric attributes' }
          : {
              subStep: SUB_STEPS.units.number,
              label: 'Map ETIM units to Akeneo measurement units',
              done: s.unmappedUnits === 0,
              detail: s.unmappedUnits === 0 ? `${count(s.metricUnits)} mapped` : `${count(s.unmappedUnits)} open`,
            },
      ]);
    case 'mapping': {
      const open = s.features - s.mappedFeatures - s.skippedFeatures;
      return work([
        {
          subStep: SUB_STEPS.mapFeatures.number,
          label: 'Map or skip every feature',
          done: open === 0,
          detail: open === 0 ? `${count(s.features)} done` : `${count(open)} open`,
        },
        {
          subStep: SUB_STEPS.mapFeatures.number,
          label: 'Set the reference entity of each A feature source',
          done: s.sourcesWithoutEntity === 0,
          ...(s.sourcesWithoutEntity > 0 ? { detail: `${count(s.sourcesWithoutEntity)} open` } : {}),
        },
      ]);
    }
    case 'records': {
      if (s.sourceEntities === 0 && s.logicalSources === 0 && s.sourcesWithoutEntity === 0) {
        return work([{ label: 'Map source values to ETIM values', done: true, detail: 'no source provides an A or L feature' }]);
      }
      const entityTasks: StepTask[] =
        s.sourceEntities === 0
          ? []
          : [
              {
                subStep: SUB_STEPS.records.number,
                label: 'Add the records of each reference entity',
                done: s.entitiesWithoutRecords === 0,
                ...(s.entitiesWithoutRecords > 0 ? { detail: `${count(s.entitiesWithoutRecords)} without records` } : {}),
              },
              {
                subStep: SUB_STEPS.records.number,
                label: 'Fill or skip an ETIM value per record and feature',
                done: s.recordValues > 0 && s.mappedRecordValues + s.skippedRecordValues === s.recordValues,
                detail:
                  `${count(s.mappedRecordValues)} of ${count(s.recordValues)} filled` +
                  (s.skippedRecordValues > 0 ? `, ${count(s.skippedRecordValues)} skipped` : ''),
              },
              {
                subStep: SUB_STEPS.records.number,
                label: 'Create the record attributes on each reference entity in Akeneo',
                detail: `${count(s.entityAttributes)} text attributes on ${count(s.sourceEntities)} ${s.sourceEntities === 1 ? 'entity' : 'entities'}, listed on each entity`,
              },
            ];
      const logicalTasks: StepTask[] =
        s.logicalSources === 0
          ? []
          : [
              {
                subStep: SUB_STEPS.sourceValues.number,
                label: 'Tick the yes values of each L feature',
                done: s.logicalWithoutYes === 0,
                ...(s.logicalWithoutYes > 0 ? { detail: `${count(s.logicalWithoutYes)} open` } : {}),
              },
            ];
      const linkTasks: StepTask[] =
        s.sourcesWithoutEntity === 0
          ? []
          : [
              {
                subStep: SUB_STEPS.mapFeatures.number,
                label: 'Set the reference entity of each A feature source',
                done: false,
                detail: `${count(s.sourcesWithoutEntity)} open`,
              },
            ];
      return work([...linkTasks, ...entityTasks, ...logicalTasks]);
    }
    case 'review': {
      const errors = s.generatorErrors;
      const warnings = s.generatorWarnings ?? 0;
      return work([
        errors === undefined
          ? { label: 'Fix all errors', detail: 'checking' }
          : { label: 'Fix all errors', done: errors === 0, ...(errors > 0 ? { detail: `${count(errors)} open` } : {}) },
        ...(warnings > 0 ? [{ label: 'Read the warnings', detail: count(warnings) }] : []),
      ]);
    }
    case 'export':
      return work([{ label: 'Download the export' }], [...s.akeneoSteps]);
  }
}

/** Open: checked by the app and not done yet. Work the app cannot check is a reminder and does not count. */
export function openTasks(work: StepWork): number {
  return work.tasks.filter((t) => t.done === false).length;
}
