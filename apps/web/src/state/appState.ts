import { createProject, type EtimClass, type EtimRelease, type Labels, type ParseIssue, type ParseResult, type Project } from '@akeneo-etim/core';

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
  | { type: 'setDisplayLocale'; locale: string };

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
  }
}

function rank(order: readonly string[], locale: string): number {
  const i = order.indexOf(locale);
  return i === -1 ? order.length : i;
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

/** Label in `locale`, else the first label there is, else empty. */
export function labelFor(labels: Labels, locale: string | undefined): string {
  if (locale !== undefined) {
    const label = labels[locale];
    if (label) return label;
  }
  return Object.values(labels).find((l) => l !== '') ?? '';
}

export interface ClassRow {
  id: string;
  label: string;
  groupId: string;
  featureCount: number;
  /** Lower-cased id and all labels, for search. */
  searchText: string;
}

export function classRows(release: EtimRelease, locale: string | undefined): ClassRow[] {
  return Object.values(release.classes)
    .map((c: EtimClass) => ({
      id: c.id,
      label: labelFor(c.labels, locale),
      groupId: c.groupId,
      featureCount: c.features.length,
      searchText: [c.id, c.groupId, ...Object.values(c.labels)].join('\n').toLowerCase(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export type SelectionFilter = 'all' | 'selected' | 'unselected';

export interface ClassFilter {
  search: string;
  groupId: string | null;
  selection: SelectionFilter;
}

/** Search matches class id, group id or a label in any locale. All words must match. */
export function filterClassRows(rows: readonly ClassRow[], filter: ClassFilter, selected: ReadonlySet<string>): ClassRow[] {
  const words = filter.search.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (filter.groupId !== null && row.groupId !== filter.groupId) return false;
    if (filter.selection === 'selected' && !selected.has(row.id)) return false;
    if (filter.selection === 'unselected' && selected.has(row.id)) return false;
    return words.every((w) => row.searchText.includes(w));
  });
}
