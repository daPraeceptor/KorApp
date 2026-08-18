/**
 * Användarens språklista — på iOS och Android.
 *
 * expo-localization läser systemets lista, inklusive det språkval per app
 * som iOS erbjuder sedan version 13. Webbens motsvarighet i spraklista.ts
 * läser webbläsaren i stället.
 */
import { getLocales } from 'expo-localization';

export function språklista(): readonly string[] {
  try {
    return getLocales()
      .map((post) => post.languageCode ?? '')
      .filter((kod) => kod.length > 0);
  } catch {
    // Utan svar från systemet får engelskan gälla, som för alla okända språk.
    return [];
  }
}
