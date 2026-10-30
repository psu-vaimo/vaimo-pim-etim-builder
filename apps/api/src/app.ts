import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  addSourceRecords,
  applySourceEntityLinks,
  applySourceMappings,
  applySourceRecordValues,
  ETIM_TABLES,
  parseEtimExport,
  parseProjectFile,
  type EtimRelease,
  type EtimTables,
  type FeatureSourceInput,
  type Project,
  type SourceEntityLinkInput,
  type SourceRecordInput,
  type SourceRecordValueInput,
} from '@akeneo-etim/core';
import { etimLibrary, type LibraryResult } from './etimLibrary.js';

/** The web app's pre-loaded ETIM exports. */
export const DEFAULT_ETIM_FILES_DIR = fileURLToPath(new URL('../../web/etim-files', import.meta.url));

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

interface EntityLinksBody {
  project: unknown;
  links: SourceEntityLinkInput[];
}

interface RecordsBody {
  project: unknown;
  entity: string;
  records: SourceRecordInput[];
}

interface RecordValuesBody {
  project: unknown;
  /** Left out: the pre-loaded export named in the project's `etimSource.library` is used. */
  release?: EtimRelease;
  values: SourceRecordValueInput[];
}

type ProjectResult = { ok: true; project: Project } | { ok: false; errors: string[] };

/** Reads the project file from a request body and applies a change, 400 with `errors` when either fails. */
function projectResponse(raw: unknown, change: (project: Project) => ProjectResult): { status: 200 | 400; body: object } {
  const parsed = parseProjectFile(JSON.stringify(raw));
  if (!parsed.ok) return { status: 400, body: { errors: [parsed.error] } };
  const result = change(parsed.project);
  return result.ok ? { status: 200, body: { project: result.project } } : { status: 400, body: { errors: result.errors } };
}

export interface AppOptions {
  /** Folder with pre-loaded ETIM exports, `<release>/<locale>/*.csv`. */
  etimFilesDir?: string;
}

export function buildApp(opts: FastifyServerOptions = {}, { etimFilesDir = DEFAULT_ETIM_FILES_DIR }: AppOptions = {}) {
  const library = etimLibrary(etimFilesDir);

  /** The release sent in the request, else the pre-loaded export the project was built on. */
  async function requestRelease(body: RecordValuesBody): Promise<LibraryResult> {
    if (body.release) return { ok: true, release: body.release };
    const parsed = parseProjectFile(JSON.stringify(body.project));
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const source = parsed.project.etimSource;
    if (!source?.library) return { ok: false, error: 'Send the release, the project names no pre-loaded ETIM export in etimSource.library' };
    return library.load(source.library, source.locales[0]);
  }
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
      const { status, body } = projectResponse(req.body.project, (p) => applySourceMappings(p, req.body.mappings));
      return reply.code(status).send(body);
    },
  );

  // Links source attributes to their customer reference entity in a project file.
  app.post<{ Body: EntityLinksBody }>(
    '/project/entity-links',
    {
      schema: {
        body: {
          type: 'object',
          required: ['project', 'links'],
          properties: {
            project: { type: 'object' },
            links: {
              type: 'array',
              items: {
                type: 'object',
                required: ['attribute', 'entity'],
                additionalProperties: false,
                properties: { attribute: { type: 'string' }, entity: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { status, body } = projectResponse(req.body.project, (p) => applySourceEntityLinks(p, req.body.links));
      return reply.code(status).send(body);
    },
  );

  // Adds records to a customer reference entity in a project file, codes and labels only.
  app.post<{ Body: RecordsBody }>(
    '/project/records',
    {
      schema: {
        body: {
          type: 'object',
          required: ['project', 'entity', 'records'],
          properties: {
            project: { type: 'object' },
            entity: { type: 'string' },
            records: {
              type: 'array',
              items: {
                type: 'object',
                required: ['code'],
                additionalProperties: false,
                properties: {
                  code: { type: 'string' },
                  labels: { type: 'object', additionalProperties: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { status, body } = projectResponse(req.body.project, (p) => addSourceRecords(p, req.body.entity, req.body.records));
      return reply.code(status).send(body);
    },
  );

  // Sets the ETIM value of source records per feature, checked against the values ETIM allows in the selected classes.
  app.post<{ Body: RecordValuesBody }>(
    '/project/record-values',
    {
      schema: {
        body: {
          type: 'object',
          required: ['project', 'values'],
          properties: {
            project: { type: 'object' },
            release: { type: 'object', required: ['classes'], properties: { classes: { type: 'object' } } },
            values: {
              type: 'array',
              items: {
                type: 'object',
                required: ['entity', 'record', 'featureId', 'valueId'],
                additionalProperties: false,
                properties: {
                  entity: { type: 'string' },
                  record: { type: 'string' },
                  featureId: { type: 'string', minLength: 1 },
                  valueId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const loaded = await requestRelease(req.body);
      if (!loaded.ok) return reply.code(400).send({ errors: [loaded.error] });
      const { status, body } = projectResponse(req.body.project, (p) => applySourceRecordValues(loaded.release, p, req.body.values));
      return reply.code(status).send(body);
    },
  );

  return app;
}
