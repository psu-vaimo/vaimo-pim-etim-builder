import {
  isRecordValueSkipped,
  mappingStatus,
  sourceEntityFor,
  type MappingStatus,
  type Project,
  type ProjectFeature,
  type SourceEntityPlan,
} from '@akeneo-etim/core';

/** The numbered steps of the workspace, opened from the sidebar in any order. */
export const SECTIONS = [
  { id: 'import', label: 'Setup ETIM versions', description: 'Upload ETIM export and translations' },
  { id: 'classes', label: 'Select Classes and Locales', description: 'Select classes and locales' },
  { id: 'features', label: 'Configure Features', description: 'Types, units, ranges' },
  { id: 'mapping', label: 'Mapping: Feature to Source attribute', description: 'Client source attributes' },
  { id: 'records', label: 'Mapping: Source record to Value', description: 'Records and source values to ETIM values' },
  { id: 'review', label: 'Review ETIM data model', description: 'Attributes, dependencies, rules' },
  { id: 'export', label: 'Export ETIM data model', description: 'Akeneo import files' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export const SECTION_COUNT = SECTIONS.length;

export interface GuardInput {
  /** Base import loaded without errors, see `isReleaseReady`. */
  ready: boolean;
  /** At least one selected class is in the release, see `hasSelectedClasses`. */
  hasClasses: boolean;
}

/**
 * Why a section cannot be opened, `undefined` when it can: everything after
 * Import needs a release without errors, everything after Classes needs a
 * selected class.
 */
export function guardReason(index: number, { ready, hasClasses }: GuardInput): string | undefined {
  if (index <= 0) return undefined;
  if (!ready) return 'Import an ETIM export without errors first';
  if (index === 1) return undefined;
  if (!hasClasses) return 'Select at least one class first';
  return undefined;
}

export function canOpen(index: number, input: GuardInput): boolean {
  return index >= 0 && index < SECTION_COUNT && guardReason(index, input) === undefined;
}

export type StatusTone = 'ok' | 'warning' | 'error' | 'muted';

export interface SectionStatus {
  text: string;
  tone: StatusTone;
  /** A second line with its own tone, e.g. the L source values under the reference entity records on step 5. */
  more?: SectionStatus;
}

export interface StatusInput extends GuardInput {
  /** A base import was made, with or without errors. */
  imported: boolean;
  /** Errors in the base import. */
  importErrors: number;
  localeCount: number;
  selectedClasses: number;
  features: number;
  mappedFeatures: number;
  /** Features not mapped on purpose. */
  skippedFeatures: number;
  /** Reference entities behind mapped A features, and their record values (records × features): all and mapped. */
  sourceEntities: number;
  recordValues: number;
  mappedRecordValues: number;
  /** Record values skipped on purpose, no ETIM value. */
  skippedRecordValues: number;
  /** Source attributes of mapped A features without a reference entity, their records cannot be mapped. */
  sourcesWithoutEntity: number;
  /** Source attributes providing L features, and the L features of non Yes/No sources without yes values. */
  logicalSources: number;
  logicalWithoutYes: number;
  /** Generator issues, `undefined` while not computed yet. */
  generatorErrors: number | undefined;
  generatorWarnings: number | undefined;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

function importStatus(s: StatusInput): SectionStatus {
  if (!s.imported) return { text: 'No ETIM export yet', tone: 'muted' };
  if (!s.ready) return { text: s.importErrors > 0 ? plural(s.importErrors, 'import error') : 'Not ready', tone: 'error' };
  return { text: `Ready, ${plural(s.localeCount, 'locale')}`, tone: 'ok' };
}

function issueText(errors: number, warnings: number): string {
  if (errors === 0 && warnings === 0) return 'No errors';
  if (errors === 0) return `No errors, ${plural(warnings, 'warning')}`;
  return warnings === 0 ? plural(errors, 'error') : `${plural(errors, 'error')}, ${plural(warnings, 'warning')}`;
}

/**
 * Step 5 has two parts with their own status: reference entity records of A features first, source values of L features
 * as the second line. A part with nothing to map is left out.
 */
function recordsStatus(s: StatusInput): SectionStatus {
  const n = (v: number) => v.toLocaleString('en-US');
  const withoutEntity = s.sourcesWithoutEntity > 0 ? `${plural(s.sourcesWithoutEntity, 'source')} without reference entity` : undefined;
  let records: SectionStatus | undefined;
  if (s.sourceEntities === 0) {
    if (withoutEntity) records = { text: `A: ${withoutEntity}`, tone: 'warning' };
  } else if (s.recordValues === 0) {
    records = { text: ['A: ' + plural(s.sourceEntities, 'entity', 'entities') + ', no records', withoutEntity].filter(Boolean).join(', '), tone: 'warning' };
  } else {
    const done = s.mappedRecordValues + s.skippedRecordValues === s.recordValues;
    records = {
      text: [
        `A: ${n(s.mappedRecordValues)} of ${n(s.recordValues)} values filled` + (s.skippedRecordValues > 0 ? `, ${n(s.skippedRecordValues)} skipped` : ''),
        withoutEntity,
      ]
        .filter(Boolean)
        .join(', '),
      tone: done && !withoutEntity ? 'ok' : 'warning',
    };
  }
  const values: SectionStatus | undefined =
    s.logicalSources === 0
      ? undefined
      : s.logicalWithoutYes > 0
        ? { text: `L: ${plural(s.logicalWithoutYes, 'feature')} without yes values`, tone: 'warning' }
        : { text: `L: ${plural(s.logicalSources, 'source')} done`, tone: 'ok' };
  if (records && values) return { ...records, more: values };
  return records ?? values ?? { text: 'No reference entity or L sources', tone: 'muted' };
}

/** Short status per section for the workspace sidebar, in section order. */
export function sectionStatuses(s: StatusInput): SectionStatus[] {
  const pending: SectionStatus = { text: 'Checking...', tone: 'muted' };
  const issues: SectionStatus =
    s.generatorErrors === undefined || s.generatorWarnings === undefined
      ? pending
      : {
          text: issueText(s.generatorErrors, s.generatorWarnings),
          tone: s.generatorErrors > 0 ? 'error' : s.generatorWarnings > 0 ? 'warning' : 'ok',
        };
  const exportStatus: SectionStatus =
    s.generatorErrors === undefined
      ? pending
      : s.generatorErrors === 0
        ? { text: 'Ready', tone: 'ok' }
        : { text: `Ready, ${plural(s.generatorErrors, 'error')} to check`, tone: 'warning' };

  return SECTIONS.map((section, index): SectionStatus => {
    const blocked = guardReason(index, s);
    if (blocked !== undefined) return { text: blocked, tone: 'muted' };
    switch (section.id) {
      case 'import':
        return importStatus(s);
      case 'classes':
        return s.selectedClasses === 0
          ? { text: 'None selected', tone: 'warning' }
          : { text: `${s.selectedClasses.toLocaleString('en-US')} selected`, tone: 'ok' };
      case 'features':
        return { text: plural(s.features, 'feature'), tone: 'ok' };
      case 'mapping':
        return {
          text:
            `${s.mappedFeatures.toLocaleString('en-US')} of ${s.features.toLocaleString('en-US')} mapped` +
            (s.skippedFeatures > 0 ? `, ${s.skippedFeatures.toLocaleString('en-US')} skipped` : ''),
          tone: s.mappedFeatures > 0 ? 'ok' : 'muted',
        };
      case 'records':
        return recordsStatus(s);
      case 'review':
        return issues;
      case 'export':
        return exportStatus;
    }
  });
}

/** Clamps a stored or computed index to a section that exists. */
export function clampSection(index: number): number {
  if (!Number.isInteger(index)) return 0;
  return Math.min(Math.max(index, 0), SECTION_COUNT - 1);
}

/** Features with at least one client source attribute. */
export function countMapped(features: readonly ProjectFeature[], config: Project['features'], status: MappingStatus = 'mapped'): number {
  return features.filter((f) => mappingStatus(config[f.key]) === status).length;
}

/** Source attributes of mapped A features that link to no reference entity. */
export function countSourcesWithoutEntity(features: readonly ProjectFeature[], project: Project): number {
  return new Set(
    features.flatMap((f) => {
      const attribute = f.type === 'A' ? project.features[f.key]?.sources?.[0]?.attribute : undefined;
      return attribute && !sourceEntityFor(project, attribute) ? [attribute] : [];
    }),
  ).size;
}

/** Record value counts for the status: one value per record and mapped feature of each reference entity. */
export function recordCounts(
  entities: readonly SourceEntityPlan[],
): Pick<StatusInput, 'sourceEntities' | 'recordValues' | 'mappedRecordValues' | 'skippedRecordValues'> {
  let recordValues = 0;
  let mappedRecordValues = 0;
  let skippedRecordValues = 0;
  for (const e of entities) {
    recordValues += e.records.length * e.features.length;
    for (const r of e.records) {
      mappedRecordValues += e.features.filter((f) => r.values[f.featureId]).length;
      skippedRecordValues += e.features.filter((f) => !r.values[f.featureId] && isRecordValueSkipped(r, f.featureId)).length;
    }
  }
  return { sourceEntities: entities.length, recordValues, mappedRecordValues, skippedRecordValues };
}
