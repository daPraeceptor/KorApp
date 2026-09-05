/**
 * Står appen upp eller ligger den ner, och hur bred är den?
 *
 * Telefonen svarar själv: ligger den ner är skärmen bredare än hög. Webben
 * har ingen telefon att vända på, och där är fönstret inte heller detsamma
 * som appen — innehållet hålls i en spalt mitt på sidan, för att texten ska
 * gå att läsa på en bredbildsskärm. Det är den spalten som avgör formen,
 * inte fönstret runt omkring.
 *
 * Därför får fönsterläget i inställningarna sista ordet i webbläsaren:
 * "Automatiskt" läser spalten, som telefonen läser sin skärm, och de andra
 * två låser vyn så att båda lägena går att se utan en telefon i handen.
 */
import { Platform } from 'react-native';

import type { WebLayout } from './state/settings';

/** Spaltens bredd i webbläsaren. Bredare än så blir raderna svårlästa. */
export const WEBB_MAXBREDD = 620;

/** Ytan appen faktiskt ritas på. På telefonen hela skärmen. */
export function innehållsbredd(fönsterbredd: number): number {
  return Platform.OS === 'web'
    ? Math.min(fönsterbredd, WEBB_MAXBREDD)
    : fönsterbredd;
}

export function ärLiggande(
  fönsterbredd: number,
  fönsterhöjd: number,
  läge: WebLayout,
): boolean {
  if (Platform.OS !== 'web' || läge === 'auto') {
    return innehållsbredd(fönsterbredd) > fönsterhöjd;
  }
  return läge === 'landscape';
}
