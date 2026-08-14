/**
 * Taktslagen, skilda från det övriga tillståndet.
 *
 * Ett taktslag hörs upp till fem gånger i sekunden. Låg pulsen i det delade
 * tillståndet skulle hela appen ritas om lika ofta — och i låtlistan betyder
 * det varje låtkort, fast bara ett enda av dem visar takten. Med några hundra
 * låtar tar en sådan omritning längre tid än ett taktslag varar, och då hinner
 * schemaläggaren inte fram i tid: pulsen börjar klumpa ihop sig.
 *
 * Därför ligger pulsen i en egen liten butik som man får prenumerera på var
 * för sig. Den som inte följer takten ritas inte om när den slår.
 */
import { useCallback, useSyncExternalStore } from 'react';

/** Ett hört taktslag: vilken taktdel, när det inföll, och hur många i rad. */
export interface BeatPulse {
  beat: number;
  at: number;
  /**
   * Löpande räknare, till skillnad från taktdelen som börjar om varje takt.
   * Pendeln behöver veta åt vilket håll den ska svänga.
   */
  count: number;
}

let nuvarande: BeatPulse | null = null;
const lyssnare = new Set<() => void>();

/** Anropas av metronomen när ett taktslag hörs, och när den stoppas. */
export function setPulse(
  uppdatering: BeatPulse | null | ((tidigare: BeatPulse | null) => BeatPulse | null),
): void {
  nuvarande =
    typeof uppdatering === 'function' ? uppdatering(nuvarande) : uppdatering;
  for (const lyssna of lyssnare) {
    lyssna();
  }
}

export function getPulse(): BeatPulse | null {
  return nuvarande;
}

const prenumerera = (lyssna: () => void) => {
  lyssnare.add(lyssna);
  return () => {
    lyssnare.delete(lyssna);
  };
};

/** Ingen prenumeration alls, för den som just nu inte följer takten. */
const tyst = () => () => {};

/**
 * Senaste taktslaget, för det som ritar takten.
 *
 * @param följer falskt för den som inte visar takten just nu — då prenumererar
 *               den inte alls, och slagen kostar den ingenting. Så kan varje
 *               låtkort i listan bära en taktvisare utan att alla ritas om.
 */
export function usePulse(följer = true): BeatPulse | null {
  const läs = useCallback(() => (följer ? nuvarande : null), [följer]);
  return useSyncExternalStore(följer ? prenumerera : tyst, läs, läs);
}
