import { describe, expect, it } from 'vitest';
import { decodeEtimFile, parseEtimExport } from '../src/index.js';

const TEXT = 'FEATUREID;FEATUREDESC\nEF000007;Färg\n';

function utf16le(text: string, bom: boolean): Uint8Array {
  const out = new Uint8Array((bom ? 2 : 0) + text.length * 2);
  let o = 0;
  if (bom) {
    out[o++] = 0xff;
    out[o++] = 0xfe;
  }
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    out[o++] = c & 0xff;
    out[o++] = c >> 8;
  }
  return out;
}

function swapBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 2) {
    out[i] = bytes[i + 1]!;
    out[i + 1] = bytes[i]!;
  }
  return out;
}

describe('decodeEtimFile', () => {
  it('decodes UTF-16LE with BOM', () => {
    expect(decodeEtimFile(utf16le(TEXT, true))).toBe(TEXT);
  });

  it('decodes UTF-16BE with BOM', () => {
    expect(decodeEtimFile(swapBytes(utf16le(TEXT, true)))).toBe(TEXT);
  });

  it('decodes UTF-16LE and BE without BOM', () => {
    expect(decodeEtimFile(utf16le(TEXT, false))).toBe(TEXT);
    expect(decodeEtimFile(swapBytes(utf16le(TEXT, false)))).toBe(TEXT);
  });

  it('decodes UTF-8 with and without BOM', () => {
    const utf8 = new TextEncoder().encode(TEXT);
    expect(decodeEtimFile(utf8)).toBe(TEXT);
    expect(decodeEtimFile(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe(TEXT);
  });

  it('feeds the parser', () => {
    const { release } = parseEtimExport({ ETIMFEATURE: decodeEtimFile(utf16le(TEXT, true)) }, 'sv_SE');
    expect(release.features.EF000007?.labels).toEqual({ sv_SE: 'Färg' });
  });
});
