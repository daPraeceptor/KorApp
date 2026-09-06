/**
 * Står appen upp eller ligger den ner?
 *
 * Telefonen svarar själv: ligger den ner är skärmen bredare än hög. Webben
 * har ingen telefon att vända på, men webbläsarfönstret är appens skärm och
 * appen fyller det helt — i bredd som i höjd. Drar man i fönsterkanten är det
 * alltså skärmen som ändrar form, precis som när telefonen vänds.
 *
 * Därför får fönsterläget i inställningarna sista ordet i webbläsaren:
 * "Automatiskt" läser fönstret, som telefonen läser sin skärm, och de andra
 * två låser vyn så att båda lägena går att se utan en telefon i handen.
 */
import { Platform } from 'react-native';

import type { WebLayout } from './state/settings';

export function ärLiggande(
  fönsterbredd: number,
  fönsterhöjd: number,
  läge: WebLayout,
): boolean {
  if (Platform.OS !== 'web' || läge === 'auto') {
    return fönsterbredd > fönsterhöjd;
  }
  return läge === 'landscape';
}
