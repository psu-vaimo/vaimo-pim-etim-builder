import { afterAll, describe, expect, it } from 'vitest';
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
});
