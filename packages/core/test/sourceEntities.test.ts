import { strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { collectSourceEntities, parseAkeneoRecordExport, sourceEntityFor, sourceRecordsTable, type Project } from '../src/index.js';
import { project, release } from './helpers.js';

function mapped(patch: Partial<Project> = {}): Project {
  return project({
    features: {
      EF005644: { sources: [{ attribute: 'att_fastening' }] },
      EF000139: { sources: [{ attribute: 'att_fastening' }] },
      EF015003: { sources: [{ attribute: 'att_bool' }] },
    },
    sourceAttributes: [{ code: 'att_fastening', type: 'akeneo_reference_entity', labels: {}, referenceDataName: 'fastening' }],
    ...patch,
  });
}

describe('sourceEntityFor', () => {
  it('uses the project link, else the uploaded reference data name', () => {
    expect(sourceEntityFor(mapped(), 'att_fastening')).toBe('fastening');
    expect(sourceEntityFor(mapped({ sourceEntityLinks: { att_fastening: 'other' } }), 'att_fastening')).toBe('other');
    expect(sourceEntityFor(mapped(), 'att_bool')).toBeUndefined();
  });
});

describe('collectSourceEntities', () => {
  it('groups mapped A features per reference entity with their allowed values', () => {
    const { entities, issues } = collectSourceEntities(release(), mapped());
    expect(entities).toEqual([
      {
        code: 'fastening',
        attributes: ['att_fastening'],
        features: [
          { key: 'EF000139', featureId: 'EF000139', attribute: 'att_fastening', valueIds: [] },
          { key: 'EF005644', featureId: 'EF005644', attribute: 'att_fastening', valueIds: ['EV023258', 'EV008374', 'EV008325', 'EV000154'] },
        ],
        records: [],
      },
    ]);
    expect(issues).toEqual([{ severity: 'warning', message: 'Reference entity fastening has no records, add them on the Source records step' }]);
  });

  it('warns about sources without entity, unmapped values and values ETIM does not allow', () => {
    const p = mapped({
      sourceAttributes: [],
      sourceEntityLinks: { att_fastening: 'fastening' },
      features: { EF005644: { sources: [{ attribute: 'att_fastening' }] }, EF000007: { sources: [{ attribute: 'att_colour' }] } },
      sourceEntities: [
        {
          code: 'fastening',
          records: [
            { code: 'eye', labels: {}, values: { EF005644: 'EV023258' } },
            { code: 'odd', labels: {}, values: { EF005644: 'EV000072' } },
            { code: 'none', labels: {}, values: {} },
          ],
        },
      ],
    });
    expect(collectSourceEntities(release(), p).issues.map((i) => i.message)).toEqual([
      'Source att_colour of EF000007 has no reference entity, register it on the mapping to map its records',
      'Reference entity fastening: 1 of 3 record values have no ETIM value',
      'Reference entity fastening: 1 values are not allowed by ETIM for the selected classes: odd EF005644=EV000072',
    ]);
  });

  it('builds the record import table', () => {
    const p = mapped({
      sourceEntities: [{ code: 'fastening', records: [{ code: 'eye', labels: {}, values: { EF005644: 'EV023258' } }] }],
    });
    const [plan] = collectSourceEntities(release(), p).entities;
    expect(sourceRecordsTable(release(), p, plan!).rows).toEqual([
      ['referenceEntityIdentifier', 'code', 'ref_ef000139', 'ref_ef000139_label', 'ref_ef005644', 'ref_ef005644_label'],
      ['fastening', 'eye', '', '', 'EV023258', 'Eye'],
    ]);
  });
});

describe('parseAkeneoRecordExport', () => {
  it('reads codes, labels and ETIM value columns, also from a file this app exported', () => {
    const csv = [
      'referenceEntityIdentifier;code;label-en_US;ref_ef005644;ref_ef005644_label;REF_EF000139;colour',
      'fastening;eye;Eye;ev023258;Eye;;red',
      'fastening;bad;;nut;;;',
      'fastening;eye;Again;;;;',
      ';;;;;;',
    ].join('\n');
    expect(parseAkeneoRecordExport(strToU8(csv), 'fastening.csv', 'ref_')).toEqual({
      records: [
        { code: 'eye', labels: { en_US: 'Eye' }, values: { EF005644: 'EV023258' } },
        { code: 'bad', labels: {}, values: {} },
      ],
      issues: [
        { severity: 'warning', message: '1 rows repeat a record code, the first row is kept' },
        { severity: 'warning', message: '1 ETIM value cells are not value ids like EV000072, skipped' },
      ],
    });
    expect(parseAkeneoRecordExport(strToU8('sku\n1'), 'x.csv', 'ref_').issues[0]?.severity).toBe('error');
  });
});
