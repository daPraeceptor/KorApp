/**
 * Tangentspannet för en låts klaviatur i listans uppfällda kort.
 *
 * Tonerna får luft omkring sig, men bilden blir aldrig smalare än en oktav:
 * en enda sparad ton gav annars en stump på fem tangenter, som varken går
 * att känna igen som ett piano eller att orientera sig i.
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
  return { från, till };
}
