import type { Labels } from './types.js';

/** Label in `locale`, else the first non-empty label, else `''`. */
export function labelFor(labels: Labels, locale: string | undefined): string {
  if (locale !== undefined) {
    const label = labels[locale];
    if (label) return label;
  }
  return Object.values(labels).find((l) => l !== '') ?? '';
}
