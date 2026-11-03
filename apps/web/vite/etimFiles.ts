import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Connect, Plugin } from 'vite';
import type { EtimLibrary } from '../src/etim/libraryTypes.js';

const FILE = /\.(csv|txt)$/i;
const byName = (a: string, b: string) => a.localeCompare(b, 'en');

/**
 * Lists the ETIM exports in `root`: one folder per release, one folder per
 * locale inside it holding the CSV files. Hidden entries, empty folders and
 * other files are skipped. Sorted by name.
 */
export function scanEtimFiles(root: string): EtimLibrary {
  const dirs = (path: string) =>
    existsSync(path) ? readdirSync(path).filter((n) => !n.startsWith('.') && statSync(join(path, n)).isDirectory()).sort(byName) : [];
  const releases = dirs(root).flatMap((name) => {
    const locales = dirs(join(root, name)).flatMap((locale) => {
      const files = readdirSync(join(root, name, locale))
        .filter((f) => FILE.test(f) && statSync(join(root, name, locale, f)).isFile())
        .sort(byName);
      return files.length > 0 ? [{ locale, files }] : [];
    });
    return locales.length > 0 ? [{ name, locales }] : [];
  });
  return { releases };
}

/** Serves `index.json` (scanned on every request, so new files show up without a restart) and the files under `url`. */
function middleware(root: string, url: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
    if (!path.startsWith(`${url}/`)) return next();
    const rest = path.slice(url.length + 1);
    if (rest === 'index.json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(scanEtimFiles(root)));
      return;
    }
    const file = resolve(root, rest);
    const inside = relative(root, file);
    if (inside === '' || inside.startsWith('..') || inside.split(sep).length !== 3 || !FILE.test(file) || !existsSync(file)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    createReadStream(file).pipe(res);
  };
}

/**
 * Vite plugin for the pre-loaded ETIM exports under `<base>etim-files`. The dev and preview servers list the folder on
 * every request, a build copies the files and a static `index.json` into the output (for GitHub Pages).
 */
export function etimFiles(root: string, folder = 'etim-files'): Plugin {
  let url = `/${folder}`;
  return {
    name: 'etim-files',
    configResolved(config) {
      url = `${config.base.replace(/\/$/, '')}/${folder}`;
    },
    configureServer(server) {
      server.middlewares.use(middleware(root, url));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(root, url));
    },
    generateBundle() {
      const library = scanEtimFiles(root);
      this.emitFile({ type: 'asset', fileName: `${folder}/index.json`, source: JSON.stringify(library) });
      for (const release of library.releases) {
        for (const { locale, files } of release.locales) {
          for (const file of files) {
            this.emitFile({ type: 'asset', fileName: `${folder}/${release.name}/${locale}/${file}`, source: readFileSync(join(root, release.name, locale, file)) });
          }
        }
      }
    },
  };
}
