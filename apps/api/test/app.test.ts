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
});
