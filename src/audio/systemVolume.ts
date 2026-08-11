/**
 * Telefonens egen ljudnivå — den som ställs med knapparna på sidan.
 *
 * Webbläsare får inte läsa systemvolymen, så här finns bara en tom
 * prenumeration. Telefonens variant ligger i systemVolume.native.ts.
 */

/**
 * Lyssnar på ändringar av telefonens ljudnivå. Anropar tillbaka med ett tal
 * mellan 0 och 1. Returnerar en funktion som avslutar prenumerationen.
 */
export function observeSystemVolume(
  _onChange: (volume: number) => void,
): () => void {
  return () => {};
}
