/**
 * Appens språk.
 *
 * Språket väljs inte i appen utan av systemet, som i alla andra appar: iOS
 * och Android har användarens språklista, och sedan iOS 13 dessutom ett val
 * per app i systeminställningarna. Appen läser listan vid start och tar
 * svenska om det står före engelska, annars engelska.
 *
 * Valet görs en gång, när modulen laddas. Byter användaren språk för appen
 * startar systemet om den, så ingen omritning behövs — och texterna kan
 * därför läsas som vanliga konstanter utan prenumerationer.
 *
 * Var språklistan kommer ifrån skiljer sig mellan plattformarna, se
 * spraklista.ts och spraklista.native.ts.
 */
import { språklista } from './spraklista.ts';
import { sv, type Texter } from './texter.sv.ts';
import { en } from './texter.en.ts';

export type Språk = 'sv' | 'en';

/** Första språket i användarens lista som appen bär. Engelska annars. */
export function väljSpråk(lista: readonly string[]): Språk {
  for (const post of lista) {
    const kod = post.toLowerCase().slice(0, 2);
    if (kod === 'sv') {
      return 'sv';
    }
    if (kod === 'en') {
      return 'en';
    }
  }
  return 'en';
}

export const språk: Språk = väljSpråk(språklista());

/** Appens alla texter, på det valda språket. */
export const T: Texter = språk === 'sv' ? sv : en;

export type { Texter } from './texter.sv.ts';
