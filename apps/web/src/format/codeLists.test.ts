import { describe, expect, it } from 'vitest';
import { pairLabelCodes } from './codeLists.js';

describe('pairLabelCodes', () => {
  it('joins a code with its label attribute right after it', () => {
    expect(pairLabelCodes(['ref_ef1', 'ref_ef1_label', 'ref_ef2', 'ref_ef3', 'ref_ef3_label', 'ref_ef3_label'], '_label')).toEqual([
      { code: 'ref_ef1', withLabel: true },
      { code: 'ref_ef2', withLabel: false },
      { code: 'ref_ef3', withLabel: true },
      { code: 'ref_ef3_label', withLabel: false },
    ]);
  });

  it('joins nothing without a suffix', () => {
    expect(pairLabelCodes(['a', 'a'], '')).toEqual([
      { code: 'a', withLabel: false },
      { code: 'a', withLabel: false },
    ]);
    expect(pairLabelCodes(['a', 'a_label'], undefined).map((c) => c.withLabel)).toEqual([false, false]);
  });
});
