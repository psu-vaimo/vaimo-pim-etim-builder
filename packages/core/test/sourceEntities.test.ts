import { strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  addSourceRecords,
  applySourceRecordValues,
  collectSourceEntities,
  isRecordValueAllowed,
  parseAkeneoRecordExport,
  sourceEntityFor,
  sourceRecordsTable,
  withRecordSkipped,
  withRecordValue,
  type EtimRelease,
  type Project,
} from '../src/index.js';
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

/** Fixture release where EC000028 also uses EF005644, with other allowed values. */
function twoClassRelease(): EtimRelease {
  const r = release();
  r.classes.EC000028!.features.push({ nr: '998', featureId: 'EF005644', type: 'A', sortNr: 9, valueIds: ['EV000072', 'EV023258'] });
  return r;
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
          {
            key: 'EF000139',
            featureId: 'EF000139',
            attribute: 'att_fastening',
            valueIds: [],
            classIds: ['EC000009'],
            classValueIds: { EC000009: [] },
            exceptionClassIds: [],
          },
          {
            key: 'EF005644',
            featureId: 'EF005644',
            attribute: 'att_fastening',
            valueIds: ['EV023258', 'EV008374', 'EV008325', 'EV000154'],
            classIds: ['EC000009'],
            classValueIds: { EC000009: ['EV023258', 'EV008374', 'EV008325', 'EV000154'] },
            exceptionClassIds: [],
          },
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
            { code: 'skip', labels: {}, values: {}, skipped: ['EF005644'] },
          ],
        },
      ],
    });
    expect(collectSourceEntities(release(), p).issues.map((i) => i.message)).toEqual([
      'Source att_colour of EF000007 has no reference entity, register it on the mapping to map its records',
      'Reference entity fastening: 1 of 4 record values have no ETIM value and are not skipped',
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

describe('addSourceRecords', () => {
  it('appends new records, merges labels of existing ones and keeps their values', () => {
    const p = mapped({ sourceEntities: [{ code: 'fastening', records: [{ code: 'eye', labels: { en_US: 'Eye' }, values: { EF005644: 'EV023258' } }] }] });
    const result = addSourceRecords(p, 'fastening', [{ code: 'hook', labels: { en_US: 'Hook' } }, { code: ' eye ', labels: { sv_SE: 'Öga' } }]);
    expect(result.ok && result.project.sourceEntities).toEqual([
      {
        code: 'fastening',
        records: [
          { code: 'eye', labels: { en_US: 'Eye', sv_SE: 'Öga' }, values: { EF005644: 'EV023258' } },
          { code: 'hook', labels: { en_US: 'Hook' }, values: {} },
        ],
      },
    ]);
    const other = addSourceRecords(p, 'colour', [{ code: 'red' }]);
    expect(other.ok && other.project.sourceEntities?.map((e) => e.code)).toEqual(['colour', 'fastening']);
  });

  it('rejects invalid and duplicate codes', () => {
    expect(addSourceRecords(mapped(), 'fast-ening', [{ code: 'a' }, { code: 'a' }, { code: '' }])).toEqual({
      ok: false,
      errors: ['Reference entity "fast-ening": Use only letters, digits and underscores', 'Record a: listed more than once', 'Record "": Code is empty'],
    });
  });
});

describe('applySourceRecordValues', () => {
  const p = mapped({
    sourceEntities: [{ code: 'fastening', records: [{ code: 'eye', labels: {}, values: { EF005644: 'EV008374' } }, { code: 'hook', labels: {}, values: {} }] }],
  });

  it('sets and clears values allowed by ETIM', () => {
    const result = applySourceRecordValues(release(), p, [
      { entity: 'fastening', record: 'hook', featureId: 'ef005644', valueId: 'ev023258' },
      { entity: 'fastening', record: 'eye', featureId: 'EF005644', valueId: '' },
    ]);
    expect(result.ok && result.project.sourceEntities?.[0]?.records).toEqual([
      { code: 'eye', labels: {}, values: {} },
      { code: 'hook', labels: {}, values: { EF005644: 'EV023258' } },
    ]);
  });

  it('accepts any value id for a feature ETIM lists no values for, the same as the checks and the report', () => {
    const result = applySourceRecordValues(release(), p, [{ entity: 'fastening', record: 'hook', featureId: 'EF000139', valueId: 'ev000072' }]);
    expect(result.ok && result.project.sourceEntities?.[0]?.records[1]?.values).toEqual({ EF000139: 'EV000072' });
    expect(result.ok && collectSourceEntities(release(), result.project).issues.filter((i) => i.message.includes('not allowed'))).toEqual([]);
    expect(applySourceRecordValues(release(), p, [{ entity: 'fastening', record: 'hook', featureId: 'EF000139', valueId: 'zinc' }])).toEqual({
      ok: false,
      errors: ['fastening hook EF000139: ZINC is not an ETIM value id like EV000072'],
    });
    expect(isRecordValueAllowed([], 'EV000072')).toBe(true);
    expect(isRecordValueAllowed([], 'X')).toBe(false);
    expect(isRecordValueAllowed(['EV000001'], 'EV000072')).toBe(false);
  });

  it('rejects values ETIM does not allow, unknown records, entities and features', () => {
    expect(
      applySourceRecordValues(release(), p, [
        { entity: 'fastening', record: 'eye', featureId: 'EF005644', valueId: 'EV000072' },
        { entity: 'fastening', record: 'nope', featureId: 'EF005644', valueId: 'EV023258' },
        { entity: 'fastening', record: 'eye', featureId: 'EF015003', valueId: '' },
        { entity: 'colour', record: 'red', featureId: 'EF005644', valueId: 'EV023258' },
        { entity: 'fastening', record: 'eye', featureId: 'EF005644', valueId: 'EV023258' },
      ]),
    ).toEqual({
      ok: false,
      errors: [
        'fastening eye EF005644: EV000072 is not allowed by ETIM for EF005644 in the selected classes',
        'fastening nope EF005644: no record nope in fastening, add it first',
        'fastening eye EF015003: EF015003 is not mapped from a source linking to fastening',
        'colour red EF005644: colour is not the reference entity of a mapped A feature in the selected classes',
        'fastening eye EF005644: listed more than once',
      ],
    });
  });
});

describe('class exceptions', () => {
  const p = mapped({
    sourceEntities: [
      {
        code: 'fastening',
        records: [
          { code: 'eye', labels: {}, values: { EF005644: 'EV023258' }, classValues: { EC000028: { EF005644: 'EV000072' } } },
          { code: 'hook', labels: {}, values: { EF005644: 'EV008374' } },
        ],
      },
    ],
  });

  it('collects exception classes and checks class values against the class', () => {
    const { entities, issues } = collectSourceEntities(twoClassRelease(), p);
    const feature = entities[0]!.features.find((f) => f.featureId === 'EF005644')!;
    expect(feature.classIds).toEqual(['EC000009', 'EC000028']);
    expect(feature.exceptionClassIds).toEqual(['EC000028']);
    expect(issues.filter((i) => i.message.includes('not allowed'))).toEqual([]);

    const odd = mapped({
      sourceEntities: [
        {
          code: 'fastening',
          records: [{ code: 'eye', labels: {}, values: {}, classValues: { EC000028: { EF005644: 'EV008374' }, EC999999: { EF005644: 'EV000072' } } }],
        },
      ],
    });
    expect(collectSourceEntities(twoClassRelease(), odd).issues.map((i) => i.message).filter((m) => m.includes('class'))).toEqual([
      'Reference entity fastening: 1 class values are for classes that are not selected or do not use the feature, ignored: eye EF005644 EC999999',
      'Reference entity fastening: 1 values are not allowed by ETIM for the selected classes: eye EF005644=EV008374 in EC000028',
    ]);
  });

  it('adds a class column pair filled with the exception, else the default', () => {
    const r = twoClassRelease();
    const [plan] = collectSourceEntities(r, p).entities;
    const rows = sourceRecordsTable(r, p, plan!).rows;
    expect(rows[0]).toEqual([
      'referenceEntityIdentifier',
      'code',
      'ref_ef000139',
      'ref_ef000139_label',
      'ref_ef005644',
      'ref_ef005644_label',
      'ref_ef005644_ec000028',
      'ref_ef005644_ec000028_label',
    ]);
    expect(rows.slice(1).map((row) => [row[1], row[4], row[6]])).toEqual([
      ['eye', 'EV023258', 'EV000072'],
      ['hook', 'EV008374', 'EV008374'],
    ]);
  });

  it('reads class columns back, skipping class values equal to the default', () => {
    const csv = ['code;ref_ef005644_ec000028;ref_ef005644', 'eye;EV000072;EV023258', 'hook;EV008374;EV008374'].join('\n');
    expect(parseAkeneoRecordExport(strToU8(csv), 'f.csv', 'ref_').records).toEqual([
      { code: 'eye', labels: {}, values: { EF005644: 'EV023258' }, classValues: { EC000028: { EF005644: 'EV000072' } } },
      { code: 'hook', labels: {}, values: { EF005644: 'EV008374' } },
    ]);
  });

  it('sets and removes class values on a record', () => {
    const record = { code: 'eye', labels: {}, values: { EF1: 'EV1' } };
    const withClass = withRecordValue(record, 'EF1', 'EC1', 'EV2');
    expect(withClass).toEqual({ ...record, classValues: { EC1: { EF1: 'EV2' } } });
    expect(withRecordValue(withClass, 'EF1', 'EC1', '')).toEqual(record);
    expect(withRecordValue(withClass, 'EF1', undefined, '')).toEqual({ code: 'eye', labels: {}, values: {}, classValues: { EC1: { EF1: 'EV2' } } });
  });

  it('skips a record value without a default value, a value removes the skip', () => {
    const record = { code: 'eye', labels: {}, values: {} };
    const skipped = withRecordSkipped(withRecordSkipped(record, 'EF2', true), 'EF1', true);
    expect(skipped).toEqual({ ...record, skipped: ['EF1', 'EF2'] });
    expect(withRecordSkipped(skipped, 'EF2', false)).toEqual({ ...record, skipped: ['EF1'] });
    expect(withRecordValue(skipped, 'EF1', undefined, 'EV1')).toEqual({ ...record, values: { EF1: 'EV1' }, skipped: ['EF2'] });
    expect(withRecordValue(skipped, 'EF1', 'EC1', 'EV1').skipped).toEqual(['EF1', 'EF2']);
    const valued = { ...record, values: { EF1: 'EV1' } };
    expect(withRecordSkipped(valued, 'EF1', true)).toBe(valued);
    expect(withRecordSkipped(withRecordSkipped(record, 'EF1', true), 'EF1', false)).toEqual(record);
  });

  it('sets class values through applySourceRecordValues, checked against the class', () => {
    const r = twoClassRelease();
    const result = applySourceRecordValues(r, p, [{ entity: 'fastening', record: 'hook', featureId: 'EF005644', classId: 'ec000028', valueId: 'EV000072' }]);
    expect(result.ok && result.project.sourceEntities?.[0]?.records[1]).toEqual({
      code: 'hook',
      labels: {},
      values: { EF005644: 'EV008374' },
      classValues: { EC000028: { EF005644: 'EV000072' } },
    });
    expect(
      applySourceRecordValues(r, p, [
        { entity: 'fastening', record: 'hook', featureId: 'EF005644', classId: 'EC000028', valueId: 'EV008374' },
        { entity: 'fastening', record: 'eye', featureId: 'EF005644', classId: 'EC000001', valueId: 'EV000072' },
      ]),
    ).toEqual({
      ok: false,
      errors: [
        'fastening hook EF005644 EC000028: EV008374 is not allowed by ETIM for EF005644 in EC000028',
        'fastening eye EF005644 EC000001: EC000001 is not a selected class using EF005644',
      ],
    });
  });
});
