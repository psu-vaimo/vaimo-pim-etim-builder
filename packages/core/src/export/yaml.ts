/**
 * Small block-style YAML writer for the rule and dependency files. Much faster
 * than a general YAML library on thousands of dependencies, and deterministic.
 *
 * - Plain scalars only for simple codes, everything else is double quoted with
 *   JSON escaping (valid YAML). Words YAML 1.1 reads as booleans or null
 *   (`yes`, `no`, `on`, `off`, `null`, ...) and number-like codes are quoted.
 * - No anchors or aliases, empty objects and lists as `{}` and `[]`.
 */
const PLAIN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const RESERVED = /^(y|n|yes|no|on|off|true|false|null)$/i;

function scalar(v: string | number | boolean | null): string {
  if (v === null) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : JSON.stringify(String(v));
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return PLAIN.test(v) && !RESERVED.test(v) ? v : JSON.stringify(v);
}

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function entries(obj: Obj): [string, unknown][] {
  return Object.entries(obj).filter(([, v]) => v !== undefined);
}

/** Lines for `value` after `prefix` (a `key:` or `-`), `indent` is the column of that key or dash. */
function write(value: unknown, indent: string, out: string[], prefix: string): void {
  if (Array.isArray(value)) {
    if (value.length === 0) return void out.push(`${prefix} []`);
    out.push(prefix);
    for (const item of value) writeItem(item, indent, out);
    return;
  }
  if (isObject(value)) {
    const items = entries(value);
    if (items.length === 0) return void out.push(`${prefix} {}`);
    out.push(prefix);
    for (const [k, v] of items) write(v, `${indent}  `, out, `${indent}  ${scalar(k)}:`);
    return;
  }
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return void out.push(`${prefix} ${scalar(value ?? null)}`);
  }
  throw new TypeError(`Cannot write ${typeof value} as YAML`);
}

/** One list item: objects start on the dash line, `- key: value`. */
function writeItem(item: unknown, indent: string, out: string[]): void {
  const dash = `${indent}  -`;
  if (isObject(item) && entries(item).length > 0) {
    const [[firstKey, firstValue], ...rest] = entries(item) as [[string, unknown], ...[string, unknown][]];
    // Keys of an item start after "- ", two columns right of the dash.
    const keyIndent = `${indent}    `;
    write(firstValue, keyIndent, out, `${dash} ${scalar(firstKey)}:`);
    for (const [k, v] of rest) write(v, keyIndent, out, `${keyIndent}${scalar(k)}:`);
    return;
  }
  write(item, `${indent}  `, out, dash);
}

/** A YAML document for a top-level mapping. */
export function toYaml(doc: Obj): string {
  const out: string[] = [];
  for (const [k, v] of entries(doc)) write(v, '', out, `${scalar(k)}:`);
  return `${out.join('\n')}\n`;
}
