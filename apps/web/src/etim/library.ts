import type { EtimLibrary, LibraryLocale, LibraryRelease } from './libraryTypes.js';

export type { EtimLibrary, LibraryLocale, LibraryRelease } from './libraryTypes.js';

/**
 * ETIM exports shipped with the app in `apps/web/etim-files/<release>/<locale>/`, listed and served by the dev server
 * and copied into a build with a static `index.json` (see `vite/etimFiles.ts`). Under the app's base path, which is
 * `/<repo>/` on GitHub Pages.
 */
export const ETIM_FILES_URL = `${import.meta.env.BASE_URL}etim-files`;

/** The pre-loaded exports, empty when the server has none or does not serve the folder. */
export async function fetchEtimLibrary(): Promise<EtimLibrary> {
  try {
    const response = await fetch(`${ETIM_FILES_URL}/index.json`);
    if (!response.ok) return { releases: [] };
    const data = (await response.json()) as Partial<EtimLibrary>;
    return { releases: Array.isArray(data.releases) ? data.releases : [] };
  } catch {
    return { releases: [] };
  }
}

export function libraryFileUrl(release: string, locale: string, file: string): string {
  return [ETIM_FILES_URL, release, locale, file].map((part, i) => (i === 0 ? part : encodeURIComponent(part))).join('/');
}

/** Downloads the files of one release locale. */
export async function fetchLibraryFiles(release: string, locale: LibraryLocale): Promise<{ name: string; bytes: ArrayBuffer }[]> {
  return Promise.all(
    locale.files.map(async (name) => {
      const response = await fetch(libraryFileUrl(release, locale.locale, name));
      if (!response.ok) throw new Error(`${release}/${locale.locale}/${name} could not be loaded (${response.status})`);
      return { name, bytes: await response.arrayBuffer() };
    }),
  );
}

/** Locale to import first: en_US when the release has it, else the first one. */
export function defaultBaseLocale(release: LibraryRelease): string | undefined {
  return (release.locales.find((l) => l.locale === 'en_US') ?? release.locales[0])?.locale;
}
