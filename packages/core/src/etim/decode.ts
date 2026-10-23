/**
 * Decodes an uploaded ETIM file to text. ETIM CSV exports are UTF-16, other
 * sources may be UTF-8. Detection order: byte order mark, then a NUL byte
 * heuristic for UTF-16 without BOM, then UTF-8.
 */
export function decodeEtimFile(bytes: Uint8Array): string {
  const [b0, b1, b2] = bytes;
  if (b0 === 0xff && b1 === 0xfe) return decode('utf-16le', bytes.subarray(2));
  if (b0 === 0xfe && b1 === 0xff) return decode('utf-16be', bytes.subarray(2));
  if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) return decode('utf-8', bytes.subarray(3));

  // ASCII text in UTF-16 has a NUL in every other byte: odd positions for LE, even for BE.
  const sample = bytes.subarray(0, Math.min(bytes.length, 1024) & ~1);
  let evenNul = 0;
  let oddNul = 0;
  for (let i = 0; i < sample.length; i += 2) {
    if (sample[i] === 0) evenNul++;
    if (sample[i + 1] === 0) oddNul++;
  }
  const pairs = sample.length / 2;
  if (pairs > 0 && oddNul / pairs > 0.3 && evenNul === 0) return decode('utf-16le', bytes);
  if (pairs > 0 && evenNul / pairs > 0.3 && oddNul === 0) return decode('utf-16be', bytes);
  return decode('utf-8', bytes);
}

function decode(encoding: string, bytes: Uint8Array): string {
  return new TextDecoder(encoding).decode(bytes);
}
