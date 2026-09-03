import { proportionellTangentbredd } from '../components/klaviaturmatt.ts';
import { isBlackKey } from '../theory/tuning.ts';

/**
 * Tangentspannet för en låts klaviatur i listans uppfällda kort.
 *
 * Tonerna får luft omkring sig, men bilden blir aldrig smalare än en oktav:
 * en enda sparad ton gav annars en stump på fem tangenter, som varken går
 * att känna igen som ett piano eller att orientera sig i.
 *
 * Båda ändarna hamnar på vita tangenter. Klaviaturens bredd räknas i vita
 * tangenter, och en svart ligger i skarven mellan två sådana — slutar spannet
 * på en svart ritas därför halva utanför bilden, och börjar det på en svart
 * uteblir den helt. Spannet växer utåt till närmaste vita, aldrig inåt, så
 * tonerna ryms fortfarande.
 */
export function klaviaturSpann(
  toner: number[],
  minstaSpann = 12,
): { från: number; till: number } {
  if (toner.length === 0) {
    return { från: 60, till: 60 + minstaSpann };
  }
  const lägsta = Math.min(...toner);
  const högsta = Math.max(...toner);
  // Tonerna plus två halvtoner på var sida, eller oktaven — det som är störst.
  const bredd = Math.max(minstaSpann, högsta - lägsta + 4);
  const mitt = (lägsta + högsta) / 2;
  let från = Math.round(mitt - bredd / 2);
  let till = från + bredd;
  // Skjut in spannet i klaviaturens ändar utan att krympa det.
  if (från < 0) {
    till -= från;
    från = 0;
  }
  if (till > 127) {
    från = Math.max(0, från - (till - 127));
    till = 127;
  }
  // Två svarta tangenter ligger aldrig intill varandra, så ett steg räcker —
  // och 0 och 127 är båda vita, så ändarna sätter stopp av sig själva.
  while (från > 0 && isBlackKey(från)) {
    från -= 1;
  }
  while (till < 127 && isBlackKey(till)) {
    till += 1;
  }
  return { från, till };
}

/**
 * Spannets övre ände när klaviaturen ska nå ända fram till högerkanten.
 *
 * Spelvyns klaviatur ritas i sin egen proportion — tangenterna breddas inte
 * ut mot kanterna, för då blir de låga och breda och slutar se ut som ett
 * piano. Ligger skärmen ner räcker då inte de två oktaverna hela vägen, och
 * kvar blir en tom remsa till höger om den sista tangenten. Ytan fylls i
 * stället med fler tangenter: de som får plats läggs till uppåt.
 *
 * Bara hela tangenter läggs till, så en smula kan bli över; den sista biten
 * tar klaviaturens egen kant-till-kant-breddning hand om. Ryms inga fler —
 * stående skärm, där spannet redan är bredare än ytan — lämnas änden orörd
 * och klaviaturen rullar i sidled som förut.
 */
export function fyllUtSpann(
  från: number,
  till: number,
  ytansBredd: number,
  fönsterhöjd: number,
): number {
  const tangentbredd = proportionellTangentbredd(fönsterhöjd);
  if (ytansBredd <= 0 || tangentbredd <= 0) {
    return till;
  }
  const rymsVita = Math.floor(ytansBredd / tangentbredd);
  let vita = 0;
  for (let midi = från; midi <= till; midi += 1) {
    if (!isBlackKey(midi)) {
      vita += 1;
    }
  }
  let ände = till;
  while (ände < 127 && vita < rymsVita) {
    ände += 1;
    if (!isBlackKey(ände)) {
      vita += 1;
    }
  }
  // Slutar aldrig på en svart tangent, av samma skäl som spannet ovan.
  while (ände < 127 && isBlackKey(ände)) {
    ände += 1;
  }
  return ände;
}
