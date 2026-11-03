import { describe, expect, it } from 'vitest';
import { loadWorkCollapsed, saveWorkCollapsed } from './workCollapsed.js';

function memoryStorage() {
  const data = new Map<string, string>();
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
