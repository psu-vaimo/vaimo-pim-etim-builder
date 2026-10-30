import type { EtimRelease } from '../etim/types.js';
import { defaultSettings } from './defaults.js';
import type { Project, ProjectSettings, SourceAttribute, SourceEntity } from './types.js';

export type ProjectFileResult = { ok: true; project: Project } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isSourceAttribute = (v: unknown): boolean => isRecord(v) && typeof v.code === 'string' && isRecord(v.labels);
const isStringRecord = (v: unknown): boolean => isRecord(v) && Object.values(v).every((x) => typeof x === 'string');
const isSourceEntity = (v: unknown): boolean =>
  isRecord(v) &&
  typeof v.code === 'string' &&
  Array.isArray(v.records) &&
  v.records.every((r) => isRecord(r) && typeof r.code === 'string' && isStringRecord(r.labels) && isStringRecord(r.values));

/** Pretty printed JSON, the format users save and load. */
export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

/** File name for a project download, `ESSVE` gives `essve.etim-project.json`. */
export function projectFileName(project: Project): string {
  const slug = project.name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'project'}.etim-project.json`;
}

/**
 * Reads a project file. Checks the format version and the shape of the fields
 * the app relies on. Settings missing in the file get defaults, one level
 * deep, so files from older app versions still load. Code settings the app no
 * longer has are dropped.
 */
export function parseProjectFile(text: string): ProjectFileResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (!isRecord(data)) return { ok: false, error: 'The file does not contain a project.' };
  if (data.formatVersion !== 1) {
    const found = data.formatVersion === undefined ? 'none' : JSON.stringify(data.formatVersion);
    return { ok: false, error: `Unsupported project format version ${found}, expected 1.` };
  }
  if (typeof data.name !== 'string') return { ok: false, error: 'The project has no name.' };
  if (!isStringArray(data.locales)) return { ok: false, error: 'The project locales must be a list of locale codes.' };
  if (!isStringArray(data.classIds)) return { ok: false, error: 'The project classIds must be a list of class ids.' };
  if (data.settings !== undefined && !isRecord(data.settings)) {
    return { ok: false, error: 'The project settings must be an object.' };
  }
  if (data.features !== undefined && !isRecord(data.features)) {
    return { ok: false, error: 'The project features must be an object.' };
  }
  if (data.sourceAttributes !== undefined && !(Array.isArray(data.sourceAttributes) && data.sourceAttributes.every(isSourceAttribute))) {
    return { ok: false, error: 'The project sourceAttributes must be a list of attributes with a code and labels.' };
  }
  if (data.sourceEntityLinks !== undefined && !isStringRecord(data.sourceEntityLinks)) {
    return { ok: false, error: 'The project sourceEntityLinks must map attribute codes to reference entity codes.' };
  }
  if (data.sourceEntities !== undefined && !(Array.isArray(data.sourceEntities) && data.sourceEntities.every(isSourceEntity))) {
    return { ok: false, error: 'The project sourceEntities must be a list of reference entities with records.' };
  }

  const project: Project = {
    formatVersion: 1,
    name: data.name,
    locales: [...new Set(data.locales)],
    classIds: [...new Set(data.classIds)].sort(),
    settings: mergeSettings(data.settings),
    features: (data.features ?? {}) as Project['features'],
    ...(data.sourceAttributes ? { sourceAttributes: data.sourceAttributes as SourceAttribute[] } : {}),
    ...(data.sourceEntityLinks ? { sourceEntityLinks: data.sourceEntityLinks as Record<string, string> } : {}),
    ...(data.sourceEntities ? { sourceEntities: data.sourceEntities as SourceEntity[] } : {}),
  };
  return { ok: true, project };
}

function mergeSettings(raw: Record<string, unknown> | undefined): ProjectSettings {
  const defaults = defaultSettings();
  if (!raw) return defaults;
  const merged: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(raw)) {
    const base = merged[key];
    merged[key] = isRecord(base) && isRecord(value) ? { ...base, ...value } : value;
  }
  if (isRecord(raw.codes)) {
    const codes = merged.codes as Record<string, unknown>;
    for (const key of Object.keys(codes)) if (!(key in defaults.codes)) delete codes[key];
  }
  return merged as unknown as ProjectSettings;
}

/** Selected class ids that are not in the release, e.g. after loading a project for another ETIM version. */
export function missingClassIds(project: Project, release: EtimRelease): string[] {
  return project.classIds.filter((id) => release.classes[id] === undefined);
}

/** Project locales that the release has no labels for. */
export function missingLocales(project: Project, release: EtimRelease): string[] {
  return project.locales.filter((l) => !release.locales.includes(l));
}
