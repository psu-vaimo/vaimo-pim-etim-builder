/** Suggestions for the locale input, the Nordic and DACH markets Vaimo works in most. */
export const LOCALE_SUGGESTIONS = ['en_US', 'en_GB', 'sv_SE', 'de_DE', 'nb_NO', 'da_DK', 'fi_FI', 'nl_NL', 'fr_FR'];

/** Akeneo locale codes: `en_US`, also with a script like `sr_Latn_RS`. */
const LOCALE_PATTERN = /^[a-z]{2,3}(_[A-Z][a-z]{3})?_[A-Z]{2}$/;

export function isLocaleCode(value: string): boolean {
  return LOCALE_PATTERN.test(value);
}
