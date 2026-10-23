/** Wizard (setup in order) or workspace (free navigation). A per-viewer convenience, not part of the project file. */
export type ViewMode = 'wizard' | 'workspace';

export const DEFAULT_MODE: ViewMode = 'wizard';
export const MODE_STORAGE_KEY = 'akeneo-etim.viewMode';

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function isViewMode(value: unknown): value is ViewMode {
  return value === 'wizard' || value === 'workspace';
}

/** The remembered mode, the default when storage is missing, blocked or holds something else. */
export function loadMode(storage: ReadStorage | undefined = browserStorage()): ViewMode {
  try {
    const value = storage?.getItem(MODE_STORAGE_KEY);
    return isViewMode(value) ? value : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

/** Remembers the mode, silently does nothing when storage is not available. */
export function saveMode(mode: ViewMode, storage: WriteStorage | undefined = browserStorage()): void {
  try {
    storage?.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Private window or blocked site data, the mode is just not remembered.
  }
}

export interface OfferInput {
  mode: ViewMode;
  /** Base import loaded without errors. */
  ready: boolean;
  /** A project file was loaded in this session. */
  projectLoaded: boolean;
  /** The wizard reached the Export step in this session. */
  reachedExport: boolean;
  /** The viewer closed the offer. */
  dismissed: boolean;
}

/**
 * Whether to suggest the workspace. Only in the wizard, once a loaded project
 * has a ready release or the wizard got to Export. It is only an offer, the
 * mode never changes by itself.
 */
export function shouldOfferWorkspace(s: OfferInput): boolean {
  if (s.mode !== 'wizard' || s.dismissed) return false;
  return (s.projectLoaded && s.ready) || s.reachedExport;
}
