/**
 * Webbens textmarkering: bara det man skriver i går att markera.
 *
 * Appen är en app, inte ett dokument. Ett långt tryck på en tangent, en
 * låttitel eller en knapp ska ge tonen eller trycket — inte Safaris blå
 * markering med förstoringsglas och «Kopiera»-meny över tangenterna. Det
 * märks värst på iPhone, där markeringen dessutom äter upp trycket den
 * började med, men gäller alla webbläsare.
 *
 * Varför ett stilblad och inte en stil på vyerna: react-native-web släpper
 * igenom `userSelect` men slänger `WebkitUserSelect` och `WebkitTouchCallout`
 * ur stilobjekten. Just de prefixade behövs på iOS — den senare har ingen
 * oprefixad motsvarighet alls, och det är den som stänger av menyn vid långt
 * tryck. Enda vägen dit är riktig CSS.
 *
 * Sökrutan och namnrutorna undantas: där ska markering, klipp och klistra
 * fungera som vanligt.
 */
const STIL_ID = 'korapp-textmarkering';

const CSS = `
* {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
input,
textarea,
[contenteditable='true'] {
  -webkit-user-select: text;
  user-select: text;
  -webkit-touch-callout: default;
}
`;

export function stängAvTextmarkering(): void {
  // Statisk export kör utan webbläsare; då finns ingen head att skriva i.
  if (typeof document === 'undefined' || document.getElementById(STIL_ID)) {
    return;
  }
  const stil = document.createElement('style');
  stil.id = STIL_ID;
  stil.textContent = CSS;
  document.head.appendChild(stil);
}
