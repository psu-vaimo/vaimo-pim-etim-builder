import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  applySourceMappings,
  ETIM_TABLES,
  parseEtimExport,
  parseProjectFile,
  type EtimTables,
  type FeatureSourceInput,
} from '@akeneo-etim/core';

/** Full ETIM exports are tens of MB as CSV. */
const BODY_LIMIT = 200 * 1024 * 1024;

interface ParseBody {
  locale: string;
  tables: EtimTables;
}

interface SourcesBody {
  project: unknown;
  mappings: FeatureSourceInput[];
}

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
              properties: Object.fromEntries(ETIM_TABLES.map((t) => [t, { type: 'string' }])),
            },
          },
        },
      },
    },
    async (req) => parseEtimExport(req.body.tables, req.body.locale),
  );

  // Maps ETIM features to customer source attributes in a project file and returns the updated project.
  app.post<{ Body: SourcesBody }>(
    '/project/sources',
    {
      schema: {
        body: {
          type: 'object',
          required: ['project', 'mappings'],
          properties: {
            project: { type: 'object' },
            mappings: {
              type: 'array',
              items: {
                type: 'object',
                required: ['featureId', 'type', 'attribute'],
                additionalProperties: false,
                properties: {
                  featureId: { type: 'string', minLength: 1 },
                  unitId: { type: 'string' },
                  type: { enum: ['A', 'N', 'L', 'R'] },
                  attribute: { type: 'string' },
                  second: { type: 'string' },
                  yesValues: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const parsed = parseProjectFile(JSON.stringify(req.body.project));
      if (!parsed.ok) return reply.code(400).send({ errors: [parsed.error] });
      const result = applySourceMappings(parsed.project, req.body.mappings);
      if (!result.ok) return reply.code(400).send({ errors: result.errors });
      return { project: result.project };
    },
  );

  return app;
}
