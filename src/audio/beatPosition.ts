/**
 * Var i svängningen den grafiska taktvisaren står.
 *
 * Ligger skild från komponenten för att kunna provas utan webbläsare: det som
 * gick fel här syntes bara som en blink vid start, och en blink är svår att
 * fånga med ögat men lätt att fånga med ett värde.
 */

/** Det taktvisaren behöver veta om ett hört taktslag. */
export interface HeardBeat {
  /** När slaget hördes, i millisekunder. */
  at: number;
  /** Löpande räknare över taktgränser, för att veta åt vilket håll det går. */
  count: number;
}

export interface BeatPosition {
  /** 0 vid taktslaget, strax under 1 precis före nästa. */
  phase: number;
  /** Varannat taktslag svänger åt andra hållet. */
  direction: 1 | -1;
}

/**
 * Räknar ut var pendeln och bollen ska stå.
 *
 * Utgångsläget — fas noll åt höger — är detsamma som första taktslagets
 * början. Därför står bilden stilla där tills klicket kommer, och fortsätter
 * sedan därifrån utan att hoppa. Räknade den i stället ur en egen klocka
 * under väntan skulle den börja mitt i en svängning och rycka till vid
 * första klicket, vilket syns som en blink.
 *
 * @param silent sant när takten visas utan ljud. Då finns inga klick att
 *               följa, och bilden går på egen klocka i stället.
 */
export function beatPosition(
  running: boolean,
  pulse: HeardBeat | null,
  bpm: number,
  silent: boolean,
  now: number,
): BeatPosition {
  const beatMs = 60000 / bpm;

  if (running && pulse) {
    return {
      phase: Math.min(Math.max((now - pulse.at) / beatMs, 0), 1),
      direction: pulse.count % 2 === 1 ? -1 : 1,
    };
  }

  if (running && silent) {
    const beats = now / beatMs;
    return {
      phase: beats % 1,
      direction: Math.floor(beats) % 2 === 1 ? -1 : 1,
    };
  }

  return { phase: 0, direction: 1 };
}
