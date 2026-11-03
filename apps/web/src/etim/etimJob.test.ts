import { describe, expect, it } from 'vitest';
import type { EtimJobFile } from './etimJob.js';
import { processEtimJob } from './etimJob.js';
import type { EtimTableName } from '@vaimo-pim-etim-builder/core';

/** UTF-16LE with BOM, like real ETIM exports. */
function utf16le(text: string): ArrayBuffer {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[3 + i * 2] = code >> 8;
  }
  return bytes.buffer;
}

const file = (table: EtimTableName, text: string): EtimJobFile => ({ table, bytes: utf16le(text) });

const EN: EtimJobFile[] = [
  file('ETIMARTCLASS', 'ARTCLASSID;ARTGROUPID;ARTCLASSDESC;ARTCLASSVERSION\nEC000009;EG000001;Hammer set anchor;7\n'),
  file('ETIMFEATURE', 'FEATUREID;FEATUREDESC\nEF005644;Fastening provision\n'),
  file('ETIMVALUE', 'VALUEID;VALUEDESC\nEV023258;Eye\n'),
  file('ETIMUNIT', 'UNITOFMEASID;UNITDESC\nEU570448;mm\n'),
  file(
    'ETIMARTCLASSFEATUREMAP',
    'ARTCLASSFEATURENR;ARTCLASSID;FEATUREID;FEATURETYPE;UNITOFMEASID;SORTNR\n123;EC000009;EF005644;A;;1\n',
  ),
  file('ETIMARTCLASSFEATUREVALUEMAP', 'ARTCLASSFEATURENR;VALUEID;SORTNR\n123;EV023258;1\n'),
];

describe('processEtimJob', () => {
  it('decodes UTF-16 files and parses an export', () => {
    const { release, issues } = processEtimJob({ kind: 'import', locale: 'en_US', files: EN });
    expect(issues).toEqual([]);
    expect(release.locales).toEqual(['en_US']);
    expect(release.classes.EC000009?.labels).toEqual({ en_US: 'Hammer set anchor' });
    expect(release.classes.EC000009?.features[0]?.valueIds).toEqual(['EV023258']);
  });

  it('merges a translation', () => {
    const base = processEtimJob({ kind: 'import', locale: 'en_US', files: EN }).release;
    const { release, issues } = processEtimJob({
      kind: 'translate',
      locale: 'sv_SE',
      release: base,
      files: [file('ETIMARTCLASS', 'ARTCLASSID;ARTGROUPID;ARTCLASSDESC;ARTCLASSVERSION\nEC000009;EG000001;Slagankare;7\n')],
    });
    expect(issues).toEqual([]);
    expect(release.locales).toEqual(['en_US', 'sv_SE']);
    expect(release.classes.EC000009?.labels).toEqual({ en_US: 'Hammer set anchor', sv_SE: 'Slagankare' });
  });

  it('reports missing tables as errors', () => {
    const { issues } = processEtimJob({ kind: 'import', locale: 'en_US', files: EN.slice(0, 5) });
    expect(issues).toContainEqual(expect.objectContaining({ severity: 'error', table: 'ETIMARTCLASSFEATUREVALUEMAP' }));
  });
});
