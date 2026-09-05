/**
 * Appens språk.
 *
 * På telefonen väljs språket inte i appen utan av systemet, som i alla andra
 * appar: iOS och Android har användarens språklista, och sedan iOS 13
 * dessutom ett val per app i systeminställningarna. Appen läser listan vid
 * start och tar svenska om det står före engelska, annars engelska. Byter
 * användaren språk för appen startar systemet om den.
 *
 * Webbläsaren har ingen sådan inställning per sida — där bär den bara sin
 * egen språklista, som gäller allt man besöker. Därför får webbversionen ett
 * eget val i inställningarna, och sättSpråk byter texterna under gång.
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

/** Språket systemet ger. På telefonen hela sanningen, på webben utgångsläget. */
export const systemspråk: Språk = väljSpråk(språklista());

/** Språket som gäller just nu. */
export let språk: Språk = systemspråk;

/**
 * Appens alla texter, på det språk som gäller just nu.
 *
 * Läses som en vanlig konstant i vyerna. Byts språket pekar bindningen om
 * till den andra ordlistan, och nästa omritning skriver hela gränssnittet på
 * det nya språket — därav sättSpråk nedan, som byter och låter den som
 * kallade den rita om.
 */
export let T: Texter = språk === 'sv' ? sv : en;

/**
 * Byter språk under gång. Bara webben behöver det; telefonen startas om av
 * systemet när språkvalet ändras där.
 *
 * Anropas inifrån den händelse som också ändrar inställningen, så att
 * omritningen den ger går på de nya texterna.
 */
export function sättSpråk(nytt: Språk): void {
  språk = nytt;
  T = nytt === 'sv' ? sv : en;
}

export type { Texter } from './texter.sv.ts';
