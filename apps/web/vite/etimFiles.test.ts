import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanEtimFiles } from './etimFiles.js';

describe('scanEtimFiles', () => {
  it('lists releases and locales with their CSV files, skipping empty and hidden entries', () => {
    const root = mkdtempSync(join(tmpdir(), 'etim-files-'));
    const add = (path: string) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), 'x');
    };
    add('ETIM-9.0/sv_SE/ETIMFEATURE.csv');
    add('ETIM-9.0/en_US/ETIMFEATURE.csv');
    add('ETIM-9.0/en_US/ETIMARTCLASS.CSV');
    add('ETIM-9.0/en_US/notes.pdf');
    add('ETIM-9.0/de_DE/readme.md');
    add('.hidden/en_US/ETIMFEATURE.csv');
    add('README.md');
    expect(scanEtimFiles(root)).toEqual({
      releases: [
        {
          name: 'ETIM-9.0',
          locales: [
            { locale: 'en_US', files: ['ETIMARTCLASS.CSV', 'ETIMFEATURE.csv'] },
            { locale: 'sv_SE', files: ['ETIMFEATURE.csv'] },
          ],
        },
      ],
    });
  });

  it('returns no releases for a missing folder', () => {
    expect(scanEtimFiles(join(tmpdir(), 'no-such-etim-folder'))).toEqual({ releases: [] });
  });
});
