import type { Project, ProjectFeature } from '@akeneo-etim/core';

/**
 * The six setup screens, shared by the wizard (Stepper, in order) and the
 * workspace (sidebar, any order). The index is the same in both modes, so
 * switching mode keeps the current screen.
 */
export const SECTIONS = [
  { id: 'import', label: 'Import ETIM', description: 'Upload ETIM export and translations' },
  { id: 'classes', label: 'Classes', description: 'Select classes and locales' },
  { id: 'features', label: 'Features', description: 'Types, units, ranges' },
  { id: 'mapping', label: 'Mapping', description: 'Customer source attributes' },
  { id: 'review', label: 'Review', description: 'Attributes, dependencies, rules' },
  { id: 'export', label: 'Export', description: 'Akeneo import files' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export const SECTION_COUNT = SECTIONS.length;
export const EXPORT_SECTION = SECTIONS.findIndex((s) => s.id === 'export');

export interface GuardInput {
  /** Base import loaded without errors, see `isReleaseReady`. */
  ready: boolean;
  /** At least one selected class is in the release, see `hasSelectedClasses`. */
  hasClasses: boolean;
}

/**
 * Why a section cannot be opened, `undefined` when it can. Same guards as the
 * wizard: everything after Import needs a release without errors, everything
 * after Classes needs a selected class.
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
          text: `${s.mappedFeatures.toLocaleString('en-US')} of ${s.features.toLocaleString('en-US')} mapped`,
          tone: s.mappedFeatures > 0 ? 'ok' : 'muted',
        };
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

/** Features with at least one customer source attribute. */
export function countMapped(features: readonly ProjectFeature[], config: Project['features']): number {
  return features.filter((f) => (config[f.key]?.sources?.length ?? 0) > 0).length;
}
