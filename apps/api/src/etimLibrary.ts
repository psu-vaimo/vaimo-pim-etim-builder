import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeEtimFile, matchTableName, parseEtimExport, type EtimRelease, type EtimTables } from '@vaimo-pim-etim-builder/core';

export type LibraryResult = { ok: true; release: EtimRelease } | { ok: false; error: string };

/**
 * Reads the pre-loaded ETIM exports in `dir/<release>/<locale>/` (the web app's
 * `etim-files`). Parsed releases are kept in memory, restart the API to pick
 * up changed files. Failures are not kept.
 */
export function etimLibrary(dir: string) {
  const cache = new Map<string, Promise<LibraryResult>>();
  return {
    /** Parses one locale of a release, the first locale folder when `locale` is not given. */
    load(library: string, locale?: string): Promise<LibraryResult> {
      const key = `${library}/${locale ?? ''}`;
      const cached = cache.get(key);
      if (cached) return cached;
      const result = read(dir, library, locale);
      cache.set(key, result);
      void result.then((r) => r.ok || cache.delete(key));
      return result;
    },
  };
}

async function folders(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

async function read(dir: string, library: string, locale: string | undefined): Promise<LibraryResult> {
  // Only names listed in the folder are used, so a request cannot point outside it.
  if (!(await folders(dir)).includes(library)) return { ok: false, error: `No pre-loaded ETIM export ${library}` };
  const locales = await folders(join(dir, library));
  const chosen = locale ?? locales[0];
  if (chosen === undefined || !locales.includes(chosen)) {
    return { ok: false, error: `No locale ${locale ?? 'folder'} in pre-loaded ETIM export ${library}` };
  }
  const path = join(dir, library, chosen);
  const tables: EtimTables = {};
  for (const file of (await readdir(path)).sort()) {
    const match = matchTableName(file);
    if (match.kind === 'matched' && /\.(csv|txt)$/i.test(file)) tables[match.table] = decodeEtimFile(await readFile(join(path, file)));
  }
  const { release, issues } = parseEtimExport(tables, chosen);
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) return { ok: false, error: `${library}/${chosen}: ${errors.map((e) => e.message).join(', ')}` };
  return { ok: true, release };
}
