import { ETIM_LABEL_TABLES, ETIM_TABLES, type EtimSource, type EtimTableName, type ParseResult } from '@akeneo-etim/core';
import type { Dispatch } from 'react';
import type { AppAction } from '../state/appState.js';
import type { EtimJobFile } from './etimJob.js';
import { fetchLibraryFiles, type EtimLibrary, type LibraryLocale } from './library.js';
import { runEtimJob } from './runEtimJob.js';
import { assignFiles } from './tableFiles.js';

/** Downloads the files of a pre-loaded locale and assigns them to tables like an upload. */
async function libraryJobFiles(
  release: string,
  locale: LibraryLocale,
  tables: readonly EtimTableName[],
): Promise<{ jobFiles: EtimJobFile[]; fileNames: string[] }> {
  const files = await fetchLibraryFiles(release, locale);
  const entries = Object.entries(assignFiles(files, tables).byTable) as [EtimTableName, { name: string; bytes: ArrayBuffer }][];
  return { jobFiles: entries.map(([table, f]) => ({ table, bytes: f.bytes })), fileNames: entries.map(([, f]) => `${release}/${locale.locale}/${f.name}`) };
}

const hasErrors = (result: ParseResult) => result.issues.some((i) => i.severity === 'error');

/** Imports `base` from a pre-loaded release, then adds `translations` when the base has no errors. Returns false when the base has errors. */
export async function importLibraryRelease(
  dispatch: Dispatch<AppAction>,
  releaseName: string,
  base: LibraryLocale,
  translations: readonly LibraryLocale[],
): Promise<boolean> {
  const baseFiles = await libraryJobFiles(releaseName, base, ETIM_TABLES);
  let result = await runEtimJob({ kind: 'import', locale: base.locale, files: baseFiles.jobFiles });
  dispatch({ type: 'baseImported', locale: base.locale, fileNames: baseFiles.fileNames, result, library: releaseName });
  if (hasErrors(result)) return false;
  for (const locale of translations) {
    const files = await libraryJobFiles(releaseName, locale, ETIM_LABEL_TABLES);
    const translated = await runEtimJob({ kind: 'translate', locale: locale.locale, release: result.release, files: files.jobFiles });
    dispatch({ type: 'translationImported', locale: locale.locale, fileNames: files.fileNames, result: translated });
    if (!hasErrors(translated)) result = translated;
  }
  return true;
}

/** What to do with the ETIM export of a loaded project. */
export type EtimReload =
  /** The export is loaded already, or the file does not say which one it uses. */
  | { kind: 'none' }
  /** Import from the pre-loaded exports. `missing` are locales the library does not have. */
  | { kind: 'library'; release: string; base: LibraryLocale; translations: LibraryLocale[]; missing: string[] }
  /** The user has to import it, `reason` says what to import. */
  | { kind: 'manual'; reason: string };

const sameSource = (a: EtimSource | undefined, b: EtimSource | undefined) =>
  a !== undefined && b !== undefined && a.library === b.library && a.locales.join() === b.locales.join();

/**
 * Decides how to get the ETIM export of a loaded project: `wanted` is the
 * source in the file, `loaded` the one of the current release (undefined when
 * none is loaded).
 */
export function planEtimReload(wanted: EtimSource | undefined, loaded: EtimSource | undefined, library: EtimLibrary): EtimReload {
  if (!wanted || sameSource(wanted, loaded)) return { kind: 'none' };
  const locales = wanted.locales.join(', ');
  if (!wanted.library) return { kind: 'manual', reason: `The project uses an uploaded ETIM export (${locales}). Import it again to continue.` };
  const release = library.releases.find((r) => r.name === wanted.library);
  const [baseLocale, ...rest] = wanted.locales;
  const base = release?.locales.find((l) => l.locale === baseLocale);
  if (!release || !base) {
    return { kind: 'manual', reason: `The project uses ETIM export ${wanted.library} (${locales}), which is not in the app's etim-files folder. Import it to continue.` };
  }
  const translations = rest.flatMap((l) => release.locales.filter((x) => x.locale === l));
  const missing = rest.filter((l) => !release.locales.some((x) => x.locale === l));
  return { kind: 'library', release: release.name, base, translations, missing };
}
