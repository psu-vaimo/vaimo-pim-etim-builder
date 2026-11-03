/** The list of pre-loaded ETIM exports, as served in `etim-files/index.json`. Shared by the app and the Vite plugin. */

export interface LibraryLocale {
  /** Folder name, an Akeneo locale code like `en_US`. */
  locale: string;
  /** File names in the folder, matched to ETIM tables by name. */
  files: string[];
}

export interface LibraryRelease {
  /** Folder name, e.g. `ETIM-9.0`. */
  name: string;
  locales: LibraryLocale[];
}

export interface EtimLibrary {
  releases: LibraryRelease[];
}
