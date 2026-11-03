/** Per-viewer conveniences kept in localStorage, not part of the project file. */

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export const WORK_COLLAPSED_STORAGE_KEY = 'akeneo-etim.workCollapsed';

/** Whether the manual work column was collapsed, open by default. */
export function loadWorkCollapsed(storage: ReadStorage | undefined = browserStorage()): boolean {
  try {
    return storage?.getItem(WORK_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Remembers the manual work column state, silently does nothing when storage is not available. */
export function saveWorkCollapsed(collapsed: boolean, storage: WriteStorage | undefined = browserStorage()): void {
  try {
    storage?.setItem(WORK_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // Not remembered.
  }
}
