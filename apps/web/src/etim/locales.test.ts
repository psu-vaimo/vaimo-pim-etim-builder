import { describe, expect, it } from 'vitest';
import { isLocaleCode } from './locales.js';

describe('isLocaleCode', () => {
  it('accepts Akeneo locale codes', () => {
    for (const code of ['en_US', 'sv_SE', 'nb_NO', 'sr_Latn_RS', 'fil_PH']) expect(isLocaleCode(code)).toBe(true);
  });
  it('rejects other formats', () => {
    for (const code of ['', 'en', 'en-US', 'EN_us', 'sv_se', ' en_US']) expect(isLocaleCode(code)).toBe(false);
  });
});
