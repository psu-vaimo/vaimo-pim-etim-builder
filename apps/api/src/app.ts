import Fastify, { type FastifyServerOptions } from 'fastify';
import { parseEtimExport, type EtimTables } from '@akeneo-etim/core';

/** Full ETIM exports are tens of MB as CSV. */
const BODY_LIMIT = 200 * 1024 * 1024;

interface ParseBody {
  locale: string;
  tables: EtimTables;
}

const tableSchema = { type: 'string' };

export function buildApp(opts: FastifyServerOptions = {}) {
  // Reject unknown keys instead of stripping them, so a misnamed table is reported.
  const app = Fastify({ bodyLimit: BODY_LIMIT, ajv: { customOptions: { removeAdditional: false } }, ...opts });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post<{ Body: ParseBody }>(
    '/etim/parse',
    {
      schema: {
        body: {
          type: 'object',
          required: ['locale', 'tables'],
          properties: {
            locale: { type: 'string', minLength: 1 },
            tables: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ETIMARTCLASS: tableSchema,
                ETIMFEATURE: tableSchema,
                ETIMVALUE: tableSchema,
                ETIMUNIT: tableSchema,
                ETIMARTCLASSFEATUREMAP: tableSchema,
                ETIMARTCLASSFEATUREVALUEMAP: tableSchema,
              },
            },
          },
        },
      },
    },
    async (req) => parseEtimExport(req.body.tables, req.body.locale),
  );

  return app;
}
