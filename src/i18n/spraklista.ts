/**
 * Användarens språklista — på webben.
 *
 * Webbläsaren bär den själv i navigator.languages, i den ordning användaren
 * ställt in. Motsvarigheten för iOS och Android ligger i
 * spraklista.native.ts och läser expo-localization.
 */

export function språklista(): readonly string[] {
  const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } })
    .navigator;
  if (nav?.languages && nav.languages.length > 0) {
    return nav.languages;
  }
  if (nav?.language) {
    return [nav.language];
  }
  return [];
}
