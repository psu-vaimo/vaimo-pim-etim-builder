/** A code in a list, `withLabel` when its label attribute (code + label suffix) is listed with it. */
export interface ListedCode {
  code: string;
  withLabel: boolean;
}

/**
 * Pairs each code with its label attribute right after it, so
 * `ref_ef000013, ref_ef000013_label` is one row of the record attribute table.
 * Without a suffix nothing is paired.
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
