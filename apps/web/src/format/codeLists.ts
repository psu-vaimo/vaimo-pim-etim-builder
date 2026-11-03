/** A code in a list, `withLabel` when its label attribute (code + label suffix) is listed with it. */
export interface ListedCode {
  code: string;
  withLabel: boolean;
}

/**
 * Joins each code with its label attribute right after it, so
 * `ref_ef000013, ref_ef000013_label` is shown as `ref_ef000013 (and _label)`.
 * Without a suffix nothing is joined.
 */
export function pairLabelCodes(codes: readonly string[], labelSuffix: string | undefined): ListedCode[] {
  const out: ListedCode[] = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]!;
    const withLabel = labelSuffix !== undefined && labelSuffix !== '' && codes[i + 1] === code + labelSuffix;
    out.push({ code, withLabel });
    if (withLabel) i++;
  }
  return out;
}
