import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createProject } from '@akeneo-etim/core';
import { buildApp } from '../src/app.js';

describe('api', () => {
  const app = buildApp();
  afterAll(() => app.close());

  it('GET /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('POST /etim/parse returns release and issues', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/etim/parse',
      payload: {
        locale: 'en_US',
        tables: { ETIMFEATURE: 'FEATUREID;FEATUREDESC\nEF000007;Colour\n' },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.release.features.EF000007.labels).toEqual({ en_US: 'Colour' });
    expect(body.issues).toContainEqual({ severity: 'error', table: 'ETIMARTCLASS', message: 'Missing table ETIMARTCLASS' });
  });

  it('POST /etim/parse accepts the optional ETIMARTGROUP table', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/etim/parse',
      payload: { locale: 'en_US', tables: { ETIMARTGROUP: 'ARTGROUPID;GROUPDESC\nEG000001;Fixings\n' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().release.groups.EG000001.labels).toEqual({ en_US: 'Fixings' });
  });

  it('POST /etim/parse rejects unknown tables', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/etim/parse',
      payload: { locale: 'en_US', tables: { NOPE: '' } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /project/sources maps features and returns the project', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/project/sources',
      payload: {
        project: createProject('Test'),
        mappings: [{ featureId: 'EF000008', unitId: 'EU570448', type: 'N', attribute: 'att_width' }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().project.features).toEqual({ EF000008_EU570448: { sources: [{ attribute: 'att_width' }] } });
  });

  it('POST /project/sources reports a bad project and bad codes', async () => {
    const send = (payload: object) => app.inject({ method: 'POST', url: '/project/sources', payload });
    const badProject = await send({ project: { name: 'x' }, mappings: [] });
    expect(badProject.statusCode).toBe(400);
    expect(badProject.json()).toEqual({ errors: ['Unsupported project format version none, expected 1.'] });
    const badCode = await send({ project: createProject('Test'), mappings: [{ featureId: 'EF1', type: 'A', attribute: 'a-b' }] });
    expect(badCode.statusCode).toBe(400);
    expect(badCode.json().errors).toEqual(['EF1: attribute "a-b": Use only letters, digits and underscores']);
    expect((await send({ project: createProject('Test'), mappings: [{ featureId: 'EF1', type: 'X', attribute: 'a' }] })).statusCode).toBe(400);
  });

  it('POST /project/records adds records to a reference entity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/project/records',
      payload: { project: createProject('Test'), entity: 'fastening', records: [{ code: 'eye', labels: { en_US: 'Eye' } }, { code: 'hook' }] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().project.sourceEntities).toEqual([
      { code: 'fastening', records: [{ code: 'eye', labels: { en_US: 'Eye' }, values: {} }, { code: 'hook', labels: {}, values: {} }] },
    ]);
    const bad = await app.inject({ method: 'POST', url: '/project/records', payload: { project: createProject('Test'), entity: 'x', records: [{ code: 'a b' }] } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().errors).toEqual(['Record "a b": Use only letters, digits and underscores']);
  });

  it('POST /project/record-values sets values ETIM allows for the feature', async () => {
    const release = {
      locales: ['en_US'],
      classes: {
        EC000009: {
          id: 'EC000009',
          groupId: 'EG000001',
          version: '1',
          labels: {},
          features: [{ nr: '1', featureId: 'EF005644', type: 'A', sortNr: 1, valueIds: ['EV000001', 'EV000002'] }],
        },
      },
      features: {},
      values: {},
      units: {},
      groups: {},
    };
    const project = {
      ...createProject('Test'),
      classIds: ['EC000009'],
      features: { EF005644: { sources: [{ attribute: 'att_fastening' }] } },
      sourceEntityLinks: { att_fastening: 'fastening' },
      sourceEntities: [{ code: 'fastening', records: [{ code: 'eye', labels: {}, values: {} }] }],
    };
    const send = (valueId: string) =>
      app.inject({
        method: 'POST',
        url: '/project/record-values',
        payload: { project, release, values: [{ entity: 'fastening', record: 'eye', featureId: 'EF005644', valueId }] },
      });
    const ok = await send('EV000002');
    expect(ok.statusCode).toBe(200);
    expect(ok.json().project.sourceEntities[0].records[0].values).toEqual({ EF005644: 'EV000002' });
    const notAllowed = await send('EV000003');
    expect(notAllowed.statusCode).toBe(400);
    expect(notAllowed.json().errors).toEqual(['fastening eye EF005644: EV000003 is not allowed by ETIM for EF005644 in the selected classes']);
  });
});

describe('api with pre-loaded ETIM exports', () => {
  const dir = mkdtempSync(join(tmpdir(), 'etim-files-'));
  cpSync(join(import.meta.dirname, '../../../packages/core/test/fixtures/en'), join(dir, 'ETIM-TEST', 'en_US'), { recursive: true });
  const app = buildApp({}, { etimFilesDir: dir });
  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const base = {
    ...createProject('Test'),
    classIds: ['EC000009'],
    features: { EF005644: { sources: [{ attribute: 'att_fastening' }] } },
    sourceEntities: [{ code: 'fastening', records: [{ code: 'eye', labels: {}, values: {} }] }],
    etimSource: { library: 'ETIM-TEST', locales: ['en_US'] },
  };
  const post = (url: string, payload: object) => app.inject({ method: 'POST', url, payload });

  it('POST /project/entity-links links source attributes to reference entities', async () => {
    const res = await post('/project/entity-links', { project: base, links: [{ attribute: 'att_fastening', entity: 'fastening' }] });
    expect(res.statusCode).toBe(200);
    expect(res.json().project.sourceEntityLinks).toEqual({ att_fastening: 'fastening' });
  });

  it('POST /project/record-values uses the pre-loaded export of the project', async () => {
    const linked = (await post('/project/entity-links', { project: base, links: [{ attribute: 'att_fastening', entity: 'fastening' }] })).json().project;
    const value = (valueId: string) => [{ entity: 'fastening', record: 'eye', featureId: 'EF005644', valueId }];
    const ok = await post('/project/record-values', { project: linked, values: value('EV023258') });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().project.sourceEntities[0].records[0].values).toEqual({ EF005644: 'EV023258' });
    const exception = await post('/project/record-values', {
      project: linked,
      values: [{ entity: 'fastening', record: 'eye', featureId: 'EF005644', classId: 'EC000009', valueId: 'EV008374' }],
    });
    expect(exception.statusCode).toBe(200);
    expect(exception.json().project.sourceEntities[0].records[0].classValues).toEqual({ EC000009: { EF005644: 'EV008374' } });
    const notAllowed = await post('/project/record-values', { project: linked, values: value('EV000072') });
    expect(notAllowed.json().errors).toEqual(['fastening eye EF005644: EV000072 is not allowed by ETIM for EF005644 in the selected classes']);
  });

  it('POST /project/record-values reports a missing or unknown pre-loaded export', async () => {
    const errors = async (etimSource: object | undefined) => {
      const { etimSource: _old, ...rest } = base;
      const res = await post('/project/record-values', { project: etimSource ? { ...rest, etimSource } : rest, values: [] });
      expect(res.statusCode).toBe(400);
      return res.json().errors;
    };
    expect(await errors(undefined)).toEqual(['Send the release, the project names no pre-loaded ETIM export in etimSource.library']);
    expect(await errors({ library: 'ETIM-9.0', locales: ['en_US'] })).toEqual(['No pre-loaded ETIM export ETIM-9.0']);
    expect(await errors({ library: '..', locales: ['en_US'] })).toEqual(['No pre-loaded ETIM export ..']);
    expect(await errors({ library: 'ETIM-TEST', locales: ['sv_SE'] })).toEqual(['No locale sv_SE in pre-loaded ETIM export ETIM-TEST']);
  });
});
