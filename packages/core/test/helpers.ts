import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createProject,
  mergeEtimTranslations,
  parseEtimExport,
  type EtimRelease,
  type EtimTableName,
  type EtimTables,
  type Project,
} from '../src/index.js';

export function loadTables(dir: string): EtimTables {
  const path = join(import.meta.dirname, 'fixtures', dir);
  const tables: EtimTables = {};
  for (const file of readdirSync(path)) {
    tables[file.replace(/\.csv$/, '') as EtimTableName] = readFileSync(join(path, file), 'utf8');
  }
  return tables;
}

/** Fixture release in en_US and sv_SE, plus an R feature with unit on EC000009. */
export function release(): EtimRelease {
  const en = parseEtimExport(loadTables('en'), 'en_US').release;
  const r = mergeEtimTranslations(en, loadTables('sv'), 'sv_SE').release;
  r.features.EF000100 = { id: 'EF000100', labels: { en_US: 'Temperature range', sv_SE: 'Temperaturområde' } };
  r.units.EU570073 = { id: 'EU570073', labels: { en_US: '°C' } };
  r.classes.EC000009!.features.push({ nr: '999', featureId: 'EF000100', type: 'R', unitId: 'EU570073', sortNr: 5, valueIds: [] });
  return r;
}

export function project(patch: Partial<Project> = {}): Project {
  return { ...createProject('test', ['en_US', 'sv_SE']), classIds: ['EC000009', 'EC000028'], ...patch };
}

export const byCode = <T extends { code: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((a) => [a.code, a]));
