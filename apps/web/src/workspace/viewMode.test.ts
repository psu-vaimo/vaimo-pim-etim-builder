import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODE,
  MODE_STORAGE_KEY,
  loadMode,
  loadWorkCollapsed,
  saveMode,
  saveWorkCollapsed,
  shouldOfferWorkspace,
  type OfferInput,
} from './viewMode.js';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: (): void => {
    throw new Error('blocked');
  },
};

describe('loadWorkCollapsed and saveWorkCollapsed', () => {
  it('is open by default and round trips', () => {
    const s = memoryStorage();
    expect(loadWorkCollapsed(s)).toBe(false);
    saveWorkCollapsed(true, s);
    expect(loadWorkCollapsed(s)).toBe(true);
    expect(loadWorkCollapsed(throwing)).toBe(false);
    expect(() => saveWorkCollapsed(true, throwing)).not.toThrow();
  });
});

describe('loadMode and saveMode', () => {
  it('defaults to the wizard', () => {
    expect(DEFAULT_MODE).toBe('wizard');
    expect(loadMode(memoryStorage())).toBe('wizard');
    expect(loadMode(undefined)).toBe('wizard');
  });

  it('round trips the mode', () => {
    const s = memoryStorage();
    saveMode('workspace', s);
    expect(s.data.get(MODE_STORAGE_KEY)).toBe('workspace');
    expect(loadMode(s)).toBe('workspace');
  });

  it('ignores unknown stored values', () => {
    expect(loadMode(memoryStorage({ [MODE_STORAGE_KEY]: 'grid' }))).toBe('wizard');
  });

  it('survives storage that throws', () => {
    expect(loadMode(throwing)).toBe('wizard');
    expect(() => saveMode('workspace', throwing)).not.toThrow();
  });
});

describe('shouldOfferWorkspace', () => {
  const base: OfferInput = { mode: 'wizard', ready: false, projectLoaded: false, reachedExport: false, dismissed: false };

  it('offers after loading a project once the release is ready', () => {
    expect(shouldOfferWorkspace({ ...base, projectLoaded: true })).toBe(false);
    expect(shouldOfferWorkspace({ ...base, ready: true })).toBe(false);
    expect(shouldOfferWorkspace({ ...base, ready: true, projectLoaded: true })).toBe(true);
  });

  it('offers once the wizard reached Export', () => {
    expect(shouldOfferWorkspace({ ...base, ready: true, reachedExport: true })).toBe(true);
  });

  it('does not offer in the workspace or after dismissal', () => {
    expect(shouldOfferWorkspace({ ...base, mode: 'workspace', ready: true, reachedExport: true })).toBe(false);
    expect(shouldOfferWorkspace({ ...base, ready: true, reachedExport: true, dismissed: true })).toBe(false);
  });
});
