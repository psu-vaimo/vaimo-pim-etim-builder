import {
  createProject,
  defaultSettings,
  labelFor,
  mappingStatus,
  normalizeSources,
  withEntityRecords as withProjectEntityRecords,
  withRecordSkipped,
  withRecordValue,
  withSourceOptions,
  withYesValue,
  withoutSourceOption,
  type AkeneoUnit,
  type EtimClass,
  type EtimRelease,
  type FeatureConfig,
  type EtimFeatureType,
  type FeatureKey,
  type LabelTexts,
  type NumericSetup,
  type ParseIssue,
  type ParseResult,
  type Project,
  type ProjectSettings,
  type RangeSetup,
  type SourceAttribute,
  type SourceMapping,
  type SourceOption,
  type SourceRecord,
} from '@vaimo-pim-etim-builder/core';
import { withoutSources } from '../mapping/sourceMappings.js';

/** One upload of ETIM files, the base export or a translation. */
export interface ImportEntry {
  kind: 'base' | 'translation';
  locale: string;
  fileNames: string[];
  issues: ParseIssue[];
  /** False when a translation had errors and was not merged. */
  applied: boolean;
}

export interface AppState {
  release: EtimRelease | undefined;
  /** The base import first, then translations in upload order. */
  imports: ImportEntry[];
  project: Project;
  /** Locale used for labels in the UI, see {@link displayLocale}. */
  displayLocale: string | undefined;
}

export type AppAction =
  /** `library` is the pre-loaded release the files came from, left out for uploads. */
  | { type: 'baseImported'; locale: string; fileNames: string[]; result: ParseResult; library?: string }
  | { type: 'translationImported'; locale: string; fileNames: string[]; result: ParseResult }
  | { type: 'projectLoaded'; project: Project }
  | { type: 'setProjectName'; name: string }
  | { type: 'setClassesSelected'; ids: readonly string[]; selected: boolean }
  | { type: 'setClassIds'; ids: readonly string[] }
  | { type: 'setProjectLocales'; locales: readonly string[] }
  | { type: 'setDisplayLocale'; locale: string }
  | { type: 'setNumericDefault'; value: NumericSetup }
  | { type: 'setRangeDefault'; value: RangeSetup }
  /** `null` means project default, the override is removed. */
  | { type: 'setFeatureNumeric'; key: FeatureKey; value: NumericSetup | null }
  /** `null` means project default, the override is removed. */
  | { type: 'setFeatureRange'; key: FeatureKey; value: RangeSetup | null }
  /** `null` removes the mapping. */
  | { type: 'setUnitMapping'; unitId: string; mapping: AkeneoUnit | null }
  /**
   * The feature's source (at most one), normalized for `featureType` (see `normalizeSources`).
   * An empty list removes `sources`, and the feature entry when nothing else is left.
   */
  | { type: 'setFeatureSources'; key: FeatureKey; featureType: EtimFeatureType; sources: readonly SourceMapping[] }
  /** Removes the sources of these features, other overrides stay. Used for mappings of features no longer selected. */
  | { type: 'removeSources'; keys: readonly FeatureKey[] }
  /** Marks a feature as not mapped on purpose, or takes that back. Ignored for a mapped feature. */
  | { type: 'setFeatureSkipped'; key: FeatureKey; skipped: boolean }
  /** Client attributes from an uploaded Akeneo attribute export, `null` removes them. Mappings are kept. */
  | { type: 'setSourceAttributes'; attributes: readonly SourceAttribute[] | null }
  /** Links a source attribute to its reference entity, `null` or empty removes the link (the uploaded reference data name applies again). */
  | { type: 'setSourceEntityLink'; attribute: string; entity: string | null }
  /**
   * Replaces the records of a reference entity, e.g. from an uploaded record export. ETIM values
   * already mapped on records with the same code are kept unless the new record has its own.
   */
  | { type: 'replaceSourceRecords'; entity: string; records: readonly SourceRecord[] }
  | { type: 'addSourceRecord'; entity: string; record: SourceRecord }
  | { type: 'removeSourceRecord'; entity: string; code: string }
  /** Sets the ETIM value of one record for one feature, for one class when `classId` is given, `null` clears it. */
  | { type: 'setSourceRecordValue'; entity: string; code: string; featureId: string; classId?: string; valueId: string | null }
  /** Marks a record as providing no ETIM value for a feature on purpose, or takes that back. Ignored when the record has a value. */
  | { type: 'setSourceRecordSkipped'; entity: string; code: string; featureId: string; skipped: boolean }
  /** Skips or unskips every listed feature of one record at once, features with a value are left as they are. */
  | { type: 'setSourceRecordSkippedAll'; entity: string; code: string; featureIds: readonly string[]; skipped: boolean }
  /**
   * Replaces the options of the listed source attributes, e.g. from an uploaded attribute option export.
   * Yes values are kept, a yes value no longer listed shows as not listed.
   */
  | { type: 'replaceSourceOptions'; options: Readonly<Record<string, readonly SourceOption[]>> }
  | { type: 'addSourceOption'; attribute: string; option: SourceOption }
  /** Removes an option, also from the yes values of the features its attribute provides. */
  | { type: 'removeSourceOption'; attribute: string; code: string }
  /** Adds a source value to the yes values of an L feature's source, or removes it. */
  | { type: 'setYesValue'; key: FeatureKey; value: string; yes: boolean }
  /** Patches code, group and label settings and the rule priority. Values are stored as typed, validation is shown in the UI. */
  | { type: 'updateSettings'; patch: SettingsPatch }
  /** Resets codes, groups, label words and rule priority to the defaults, keeps number/range defaults and unit mappings. */
  | { type: 'resetNamingSettings' };

export interface SettingsPatch {
  codes?: Partial<ProjectSettings['codes']>;
  groups?: Partial<ProjectSettings['groups']>;
  rulePriority?: number;
  /** Per locale, partial label words. */
  labelTexts?: Record<string, Partial<LabelTexts>>;
}

export function initialState(): AppState {
  return { release: undefined, imports: [], project: createProject(''), displayLocale: undefined };
}

const hasErrors = (issues: readonly ParseIssue[]) => issues.some((i) => i.severity === 'error');

/** Adds release locales the project does not have yet, so new languages are selected by default. */
function withLocales(project: Project, locales: readonly string[]): Project {
  const add = locales.filter((l) => !project.locales.includes(l));
  return add.length === 0 ? project : { ...project, locales: [...project.locales, ...add] };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'baseImported': {
      const { release, issues } = action.result;
      const entry: ImportEntry = { kind: 'base', locale: action.locale, fileNames: action.fileNames, issues, applied: true };
      const project = withLocales(state.project, release.locales);
      // Only a usable import is remembered, so loading the project imports it again.
      const etimSource = { ...(action.library ? { library: action.library } : {}), locales: [action.locale] };
      return {
        ...state,
        release,
        imports: [entry],
        project: hasErrors(issues) ? project : { ...project, etimSource },
      };
    }
    case 'translationImported': {
      const { release, issues } = action.result;
      const applied = !hasErrors(issues);
      const entry: ImportEntry = { kind: 'translation', locale: action.locale, fileNames: action.fileNames, issues, applied };
      if (!applied) return { ...state, imports: [...state.imports, entry] };
      const project = withLocales(state.project, [action.locale]);
      const source = project.etimSource;
      return {
        ...state,
        release,
        imports: [...state.imports, entry],
        project:
          source && !source.locales.includes(action.locale)
            ? { ...project, etimSource: { ...source, locales: [...source.locales, action.locale] } }
            : project,
      };
    }
    case 'projectLoaded': {
      // An older file without a source keeps the release that is loaded, so saving records it.
      const etimSource = action.project.etimSource ?? state.project.etimSource;
      return { ...state, project: etimSource ? { ...action.project, etimSource } : action.project };
    }
    case 'setProjectName':
      return { ...state, project: { ...state.project, name: action.name } };
    case 'setClassesSelected': {
      const ids = new Set(state.project.classIds);
      for (const id of action.ids) {
        if (action.selected) ids.add(id);
        else ids.delete(id);
      }
      return { ...state, project: { ...state.project, classIds: [...ids].sort() } };
    }
    case 'setClassIds':
      return { ...state, project: { ...state.project, classIds: [...new Set(action.ids)].sort() } };
    case 'setProjectLocales': {
      // Keep release order so the saved file is stable.
      const order = state.release?.locales ?? [];
      const locales = [...new Set(action.locales)].sort((a, b) => rank(order, a) - rank(order, b));
      return { ...state, project: { ...state.project, locales } };
    }
    case 'setDisplayLocale':
      return { ...state, displayLocale: action.locale };
    case 'setNumericDefault':
      return withSettings(state, { numeric: action.value });
    case 'setRangeDefault':
      return withSettings(state, { range: action.value });
    case 'setFeatureNumeric':
      return {
        ...state,
        project: { ...state.project, features: withFeatureField(state.project.features, action.key, 'numeric', action.value) },
      };
    case 'setFeatureRange':
      return {
        ...state,
        project: { ...state.project, features: withFeatureField(state.project.features, action.key, 'range', action.value) },
      };
    case 'setFeatureSources': {
      const sources = normalizeSources(action.sources, action.featureType);
      const features = withFeatureField(state.project.features, action.key, 'sources', sources.length === 0 ? null : sources);
      return {
        ...state,
        project: { ...state.project, features: sources.length === 0 ? features : withFeatureField(features, action.key, 'skipped', null) },
      };
    }
    case 'setFeatureSkipped':
      if (action.skipped && mappingStatus(state.project.features[action.key]) === 'mapped') return state;
      return {
        ...state,
        project: { ...state.project, features: withFeatureField(state.project.features, action.key, 'skipped', action.skipped ? true : null) },
      };
    case 'removeSources':
      return { ...state, project: { ...state.project, features: withoutSources(state.project.features, action.keys) } };
    case 'setSourceEntityLink': {
      const { [action.attribute]: _old, ...links } = state.project.sourceEntityLinks ?? {};
      const entity = action.entity?.trim() ?? '';
      const next = entity === '' ? links : { ...links, [action.attribute]: entity };
      const { sourceEntityLinks: _links, ...project } = state.project;
      return { ...state, project: Object.keys(next).length > 0 ? { ...project, sourceEntityLinks: next } : project };
    }
    case 'replaceSourceRecords':
      return withEntityRecords(state, action.entity, (old) => {
        const byCode = new Map(old.map((r) => [r.code, r]));
        return action.records.map((r) => {
          const previous = byCode.get(r.code)?.classValues ?? {};
          const classValues = { ...previous };
          for (const [classId, values] of Object.entries(r.classValues ?? {})) classValues[classId] = { ...previous[classId], ...values };
          const values = { ...byCode.get(r.code)?.values, ...r.values };
          const skipped = (byCode.get(r.code)?.skipped ?? []).filter((id) => !values[id]);
          const merged: SourceRecord = { ...r, values, ...(skipped.length > 0 ? { skipped } : {}) };
          return Object.keys(classValues).length > 0 ? { ...merged, classValues } : merged;
        });
      });
    case 'addSourceRecord':
      return withEntityRecords(state, action.entity, (old) =>
        old.some((r) => r.code === action.record.code) ? [...old] : [...old, action.record],
      );
    case 'removeSourceRecord':
      return withEntityRecords(state, action.entity, (old) => old.filter((r) => r.code !== action.code));
    case 'setSourceRecordValue':
      return withEntityRecords(state, action.entity, (old) =>
        old.map((r) => (r.code === action.code ? withRecordValue(r, action.featureId, action.classId, action.valueId ?? '') : r)),
      );
    case 'setSourceRecordSkipped':
      return withEntityRecords(state, action.entity, (old) =>
        old.map((r) => (r.code === action.code ? withRecordSkipped(r, action.featureId, action.skipped) : r)),
      );
    case 'replaceSourceOptions': {
      let project = state.project;
      for (const [attribute, options] of Object.entries(action.options)) project = withSourceOptions(project, attribute, options);
      return { ...state, project };
    }
    case 'addSourceOption': {
      const current = state.project.sourceOptions?.[action.attribute] ?? [];
      if (current.some((o) => o.code === action.option.code)) return state;
      return { ...state, project: withSourceOptions(state.project, action.attribute, [...current, action.option]) };
    }
    case 'removeSourceOption':
      return { ...state, project: withoutSourceOption(state.project, action.attribute, action.code) };
    case 'setYesValue':
      return { ...state, project: withYesValue(state.project, action.key, action.value, action.yes) };
    case 'setSourceRecordSkippedAll':
      return withEntityRecords(state, action.entity, (old) =>
        old.map((r) => (r.code === action.code ? action.featureIds.reduce((rec, id) => withRecordSkipped(rec, id, action.skipped), r) : r)),
      );
    case 'setSourceAttributes': {
      const { sourceAttributes: _old, ...project } = state.project;
      return { ...state, project: action.attributes ? { ...project, sourceAttributes: [...action.attributes] } : project };
    }
    case 'setUnitMapping': {
      const { [action.unitId]: _removed, ...rest } = state.project.settings.unitMap;
      const family = action.mapping?.family.trim() ?? '';
      const unit = action.mapping?.unit.trim() ?? '';
      // Only complete mappings are stored, a half filled one would give a metric attribute without unit.
      const unitMap = family && unit ? { ...rest, [action.unitId]: { family, unit } } : rest;
      return withSettings(state, { unitMap });
    }
    case 'updateSettings': {
      const { codes, groups, labelTexts } = state.project.settings;
      const { patch } = action;
      const nextTexts = { ...labelTexts };
      for (const [locale, texts] of Object.entries(patch.labelTexts ?? {})) {
        nextTexts[locale] = { ...(labelTexts[locale] ?? labelTexts.en_US ?? defaultSettings().labelTexts.en_US!), ...texts };
      }
      return withSettings(state, {
        codes: { ...codes, ...patch.codes },
        groups: { ...groups, ...patch.groups },
        labelTexts: nextTexts,
        ...(patch.rulePriority !== undefined ? { rulePriority: patch.rulePriority } : {}),
      });
    }
    case 'resetNamingSettings': {
      const d = defaultSettings();
      return withSettings(state, { codes: d.codes, groups: d.groups, labelTexts: d.labelTexts, rulePriority: d.rulePriority });
    }
  }
}

function withSettings(state: AppState, patch: Partial<Project['settings']>): AppState {
  return { ...state, project: { ...state.project, settings: { ...state.project.settings, ...patch } } };
}

/**
 * Sets or removes (`null`) one override field of a feature. An entry left
 * without fields is removed, so the project file only lists real overrides.
 */
function withFeatureField<F extends keyof FeatureConfig>(
  features: Project['features'],
  key: FeatureKey,
  field: F,
  value: NonNullable<FeatureConfig[F]> | null,
): Project['features'] {
  const { [key]: current, ...rest } = features;
  const { [field]: _old, ...others } = current ?? {};
  const next: FeatureConfig = value === null ? others : { ...others, [field]: value };
  return Object.keys(next).length === 0 ? rest : { ...rest, [key]: next };
}

function rank(order: readonly string[], locale: string): number {
  const i = order.indexOf(locale);
  return i === -1 ? order.length : i;
}

/** True when at least one selected class is in the release, the condition to leave step 2. */
export function hasSelectedClasses(state: AppState): boolean {
  const { release } = state;
  return release !== undefined && state.project.classIds.some((id) => release.classes[id] !== undefined);
}

/** True when the base import is loaded without errors, the condition to leave step 1. */
export function isReleaseReady(state: AppState): boolean {
  const base = state.imports[0];
  return state.release !== undefined && base !== undefined && !hasErrors(base.issues);
}

export function displayLocale(state: AppState): string | undefined {
  const locales = state.release?.locales ?? [];
  if (state.displayLocale !== undefined && locales.includes(state.displayLocale)) return state.displayLocale;
  return locales[0];
}

export interface ClassRow {
  id: string;
  label: string;
  groupId: string;
  /** Group name in the display locale, `''` when the release has no name for it. */
  groupLabel: string;
  featureCount: number;
  /** Lower-cased id and all labels, for search. */
  searchText: string;
}

export function classRows(release: EtimRelease, locale: string | undefined): ClassRow[] {
  return Object.values(release.classes)
    .map((c: EtimClass) => {
      const groupLabels = release.groups[c.groupId]?.labels ?? {};
      return {
        id: c.id,
        label: labelFor(c.labels, locale),
        groupId: c.groupId,
        groupLabel: labelFor(groupLabels, locale),
        featureCount: c.features.length,
        searchText: [c.id, c.groupId, ...Object.values(c.labels), ...Object.values(groupLabels)].join('\n').toLowerCase(),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export type SelectionFilter = 'all' | 'selected' | 'unselected';

export interface ClassFilter {
  search: string;
  groupId: string | null;
  selection: SelectionFilter;
}

export interface GroupOption {
  value: string;
  label: string;
}

/** Group filter options with class counts, `EG000001 Fixings (12)`, or the id alone when the group has no name. */
export function groupOptions(rows: readonly ClassRow[]): GroupOption[] {
  const groups = new Map<string, { label: string; count: number }>();
  for (const row of rows) {
    const g = groups.get(row.groupId);
    if (g) g.count += 1;
    else groups.set(row.groupId, { label: row.groupLabel, count: 1 });
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, g]) => ({ value: id, label: `${id}${g.label ? ` ${g.label}` : ''} (${g.count})` }));
}

/**
 * Splits a search into terms on new line, tab, comma or semicolon, each term into lower-case words.
 * A pasted list of class ids becomes one term per id.
 */
function searchTerms(search: string): string[][] {
  return search
    .split(/[\n\r\t,;]+/)
    .map((term) => term.toLowerCase().split(/\s+/).filter(Boolean))
    .filter((words) => words.length > 0);
}

function matchesTerm(row: ClassRow, words: readonly string[]): boolean {
  return words.every((w) => row.searchText.includes(w));
}

/** Search matches class id, group id or name, or a label in any locale. A row matches when all words of any term match. */
export function filterClassRows(rows: readonly ClassRow[], filter: ClassFilter, selected: ReadonlySet<string>): ClassRow[] {
  const terms = searchTerms(filter.search);
  return rows.filter((row) => {
    if (filter.groupId !== null && row.groupId !== filter.groupId) return false;
    if (filter.selection === 'selected' && !selected.has(row.id)) return false;
    if (filter.selection === 'unselected' && selected.has(row.id)) return false;
    return terms.length === 0 || terms.some((words) => matchesTerm(row, words));
  });
}

/** Terms of a list search (more than one term) that match no class, as typed. Ignores the group and selection filters. */
export function unmatchedSearchTerms(rows: readonly ClassRow[], search: string): string[] {
  const raw = search.split(/[\n\r\t,;]+/).map((t) => t.trim()).filter(Boolean);
  if (raw.length < 2) return [];
  return raw.filter((term) => {
    const words = term.toLowerCase().split(/\s+/);
    return !rows.some((row) => matchesTerm(row, words));
  });
}

/** Updates the records of one reference entity, entities stay sorted by code and empty ones are dropped. */
function withEntityRecords(state: AppState, entity: string, update: (records: readonly SourceRecord[]) => SourceRecord[]): AppState {
  const records = update(state.project.sourceEntities?.find((e) => e.code === entity)?.records ?? []);
  return { ...state, project: withProjectEntityRecords(state.project, entity, records) };
}
