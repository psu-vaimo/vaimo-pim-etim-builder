import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { labelFor, mergeEtimTranslations, parseEtimExport, type EtimTableName, type EtimTables } from '../src/index.js';

function loadTables(dir: string): EtimTables {
  const path = join(import.meta.dirname, 'fixtures', dir);
  const tables: EtimTables = {};
  for (const file of readdirSync(path)) {
    tables[file.replace(/\.csv$/, '') as EtimTableName] = readFileSync(join(path, file), 'utf8');
  }
  return tables;
}

describe('parseEtimExport', () => {
  const { release, issues } = parseEtimExport(loadTables('en'), 'en_US');

  it('parses without issues', () => {
    expect(issues).toEqual([]);
  });

  it('reads classes with labels, version and optional date', () => {
    expect(release.locales).toEqual(['en_US']);
    expect(release.classes.EC000009).toMatchObject({
      id: 'EC000009',
      groupId: 'EG000001',
      version: '7',
      labels: { en_US: 'Hammer set anchor' },
    });
    expect(release.classes.EC000009).not.toHaveProperty('versionDate');
    expect(release.classes.EC000028?.versionDate).toBe('2021-06-01');
  });

  it('reads features, values and units across delimiters', () => {
    expect(release.features.EF015006?.labels).toEqual({ en_US: 'Max. clamping thickness' });
    expect(release.values.EV008374?.labels).toEqual({ en_US: 'L-hook' });
    expect(release.units.EU570448?.labels).toEqual({ en_US: 'mm' });
  });

  it('orders class features by SORTNR and keeps type and unit', () => {
    const features = release.classes.EC000009?.features ?? [];
    expect(features.map((f) => f.featureId)).toEqual(['EF005644', 'EF015003', 'EF015006', 'EF000139']);
    expect(features[2]).toEqual({
      nr: '127',
      featureId: 'EF015006',
      type: 'N',
      unitId: 'EU570448',
      sortNr: 3,
      valueIds: [],
    });
    expect(features[1]).not.toHaveProperty('unitId');
  });

  it('reads optional group names', () => {
    expect(release.groups.EG000001?.labels).toEqual({ en_US: 'Fixings' });
  });

  it('orders allowed values by SORTNR', () => {
    expect(release.classes.EC000009?.features[0]?.valueIds).toEqual(['EV023258', 'EV008374', 'EV008325', 'EV000154']);
  });

  it('is JSON serializable', () => {
    expect(JSON.parse(JSON.stringify(release))).toEqual(release);
  });
});

describe('parseEtimExport problems', () => {
  const base = loadTables('en');

  it('reports missing tables and columns as errors', () => {
    const { ETIMUNIT: _, ...withoutUnits } = base;
    const { issues } = parseEtimExport({ ...withoutUnits, ETIMVALUE: 'VALUEID\nEV1\n' }, 'en_US');
    expect(issues).toContainEqual({ severity: 'error', table: 'ETIMUNIT', message: 'Missing table ETIMUNIT' });
    expect(issues).toContainEqual({ severity: 'error', table: 'ETIMVALUE', message: 'Missing columns: VALUEDESC' });
  });

  it('skips rows with broken references with a warning', () => {
    const { release, issues } = parseEtimExport(
      {
        ...base,
        ETIMARTCLASSFEATUREMAP:
          'ARTCLASSFEATURENR;ARTCLASSID;FEATUREID;FEATURETYPE;UNITOFMEASID;SORTNR\n' +
          '1;EC000009;EF005644;A;;1\n' +
          '2;EC999999;EF005644;A;;2\n' +
          '3;EC000009;EF999999;A;;3\n' +
          '4;EC000009;EF000139;X;;4\n' +
          '5;EC000009;EF015006;N;EU999999;5\n' +
          '1;EC000009;EF000139;A;;6\n' +
          '7;EC000009;EF015003;l;;7\n',
        ETIMARTCLASSFEATUREVALUEMAP:
          'ARTCLASSFEATURENR;VALUEID;SORTNR\n' + '1;EV023258;1\n' + '1;EV023258;2\n' + '9;EV023258;1\n' + '1;EV999999;3\n' + '7;EV023258;1\n',
      },
      'en_US',
    );
    expect(issues.map((i) => [i.table, i.row, i.message])).toEqual([
      ['ETIMARTCLASSFEATUREMAP', 2, 'Unknown class EC999999, row skipped'],
      ['ETIMARTCLASSFEATUREMAP', 3, 'Unknown feature EF999999, row skipped'],
      ['ETIMARTCLASSFEATUREMAP', 4, 'Unknown feature type "X" for EC000009/EF000139, row skipped'],
      ['ETIMARTCLASSFEATUREMAP', 5, 'Unknown unit EU999999, row skipped'],
      ['ETIMARTCLASSFEATUREMAP', 6, 'Duplicate ARTCLASSFEATURENR 1, row skipped'],
      ['ETIMARTCLASSFEATUREVALUEMAP', 2, 'Duplicate value EV023258 for nr 1, row skipped'],
      ['ETIMARTCLASSFEATUREVALUEMAP', 3, 'Unknown ARTCLASSFEATURENR 9, row skipped'],
      ['ETIMARTCLASSFEATUREVALUEMAP', 4, 'Unknown value EV999999, row skipped'],
      ['ETIMARTCLASSFEATUREVALUEMAP', 5, 'Value EV023258 on L feature EF015003 (nr 7), row skipped'],
    ]);
    expect(issues.every((i) => i.severity === 'warning')).toBe(true);
    const features = release.classes.EC000009?.features ?? [];
    expect(features.map((f) => [f.nr, f.type])).toEqual([
      ['1', 'A'],
      ['7', 'L'],
    ]);
    expect(features[0]?.valueIds).toEqual(['EV023258']);
  });

  it('works without ETIMARTGROUP and warns about unknown groups when present', () => {
    const { ETIMARTGROUP: _, ...withoutGroups } = base;
    const without = parseEtimExport(withoutGroups, 'en_US');
    expect(without.issues).toEqual([]);
    expect(without.release.groups).toEqual({});

    const { issues } = parseEtimExport({ ...base, ETIMARTGROUP: 'ARTGROUPID;ARTGROUPDESC\nEG000002;Other\n' }, 'en_US');
    expect(issues).toEqual([{ severity: 'warning', table: 'ETIMARTCLASS', message: 'Unknown groups: EG000001' }]);
  });

  it('warns on duplicate ids and keeps the first', () => {
    const { release, issues } = parseEtimExport(
      { ...base, ETIMUNIT: 'UNITOFMEASID;UNITDESC\nEU570448;mm\nEU570448;millimetre\n' },
      'en_US',
    );
    expect(release.units.EU570448?.labels.en_US).toBe('mm');
    expect(issues).toEqual([
      { severity: 'warning', table: 'ETIMUNIT', row: 2, message: 'Duplicate UNITOFMEASID EU570448, row skipped' },
    ]);
  });
});

describe('labelFor', () => {
  it('falls back to the first non-empty label', () => {
    expect(labelFor({ en_US: 'Colour', sv_SE: 'Färg' }, 'sv_SE')).toBe('Färg');
    expect(labelFor({ en_US: '', sv_SE: 'Färg' }, 'de_DE')).toBe('Färg');
    expect(labelFor({}, undefined)).toBe('');
  });
});

describe('mergeEtimTranslations', () => {
  const { release } = parseEtimExport(loadTables('en'), 'en_US');
  const { release: merged, issues } = mergeEtimTranslations(release, loadTables('sv'), 'sv_SE');

  it('adds labels for the new locale', () => {
    expect(merged.locales).toEqual(['en_US', 'sv_SE']);
    expect(merged.classes.EC000028?.labels).toEqual({ en_US: 'Threaded rod', sv_SE: 'Gängad stång' });
    expect(merged.features.EF005644?.labels).toEqual({ en_US: 'Fastening provision', sv_SE: 'Fästanordning' });
    expect(merged.groups.EG000001?.labels).toEqual({ en_US: 'Fixings', sv_SE: 'Infästning' });
  });

  it('leaves labels missing where the translation has no row', () => {
    expect(merged.features.EF015003?.labels).toEqual({ en_US: 'Pre-positioned installation' });
  });

  it('counts unknown ids in one warning per table', () => {
    expect(issues).toEqual([
      { severity: 'warning', table: 'ETIMARTCLASS', message: '1 ids not in the release were ignored' },
    ]);
  });

  it('does not change the input release', () => {
    expect(release.locales).toEqual(['en_US']);
    expect(release.classes.EC000009?.labels).toEqual({ en_US: 'Hammer set anchor' });
  });
});
