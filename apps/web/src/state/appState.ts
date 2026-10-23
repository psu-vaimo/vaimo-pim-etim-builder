import {
  createProject,
  defaultSettings,
  labelFor,
  normalizeSources,
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
  type SourceMapping,
} from '@akeneo-etim/core';
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
  | { type: 'baseImported'; locale: string; fileNames: string[]; result: ParseResult }
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
   * Sources in preference order, normalized for `featureType` (see `normalizeSources`).
   * An empty list removes `sources`, and the feature entry when nothing else is left.
   */
  | { type: 'setFeatureSources'; key: FeatureKey; featureType: EtimFeatureType; sources: readonly SourceMapping[] }
  /** Removes the sources of these features, other overrides stay. Used for mappings of features no longer selected. */
  | { type: 'removeSources'; keys: readonly FeatureKey[] }
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
      return {
        ...state,
        release,
        imports: [entry],
        project: withLocales(state.project, release.locales),
      };
    }
    case 'translationImported': {
      const { release, issues } = action.result;
      const applied = !hasErrors(issues);
      const entry: ImportEntry = { kind: 'translation', locale: action.locale, fileNames: action.fileNames, issues, applied };
      if (!applied) return { ...state, imports: [...state.imports, entry] };
      return {
        ...state,
        release,
        imports: [...state.imports, entry],
        project: withLocales(state.project, [action.locale]),
      };
    }
    case 'projectLoaded':
      return { ...state, project: action.project };
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
      return {
        ...state,
        project: {
          ...state.project,
          features: withFeatureField(state.project.features, action.key, 'sources', sources.length === 0 ? null : sources),
        },
      };
    }
    case 'removeSources':
      return { ...state, project: { ...state.project, features: withoutSources(state.project.features, action.keys) } };
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

/** Search matches class id, group id or name, or a label in any locale. All words must match. */
export function filterClassRows(rows: readonly ClassRow[], filter: ClassFilter, selected: ReadonlySet<string>): ClassRow[] {
  const words = filter.search.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (filter.groupId !== null && row.groupId !== filter.groupId) return false;
    if (filter.selection === 'selected' && !selected.has(row.id)) return false;
    if (filter.selection === 'unselected' && selected.has(row.id)) return false;
    return words.every((w) => row.searchText.includes(w));
  });
}
