import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';

const etimFilesDir = process.env.ETIM_FILES_DIR;
const app = buildApp({ logger: true }, etimFilesDir ? { etimFilesDir } : {});
await app.listen({ port, host });
