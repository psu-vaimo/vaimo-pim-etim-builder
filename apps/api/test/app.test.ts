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
