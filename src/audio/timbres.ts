/**
 * Klangfärger för tongivningen.
 *
 * Varje klang beskrivs som en uppsättning deltoner plus en anslagskurva. Allt
 * byggs av rena sinustoner, så samma beskrivning fungerar likadant på webben
 * och i mobilappen utan extra ljudnoder.
 *
 * En sak att känna till: skillnaden mellan tempererad och ren stämning hörs
 * bara om klangen faktiskt innehåller de deltoner som svävar mot varandra —
 * framför allt den femte. Därför bär även de mjukaste klangerna här en svag
 * femte och sjätte delton, i stället för att vara helt rena sinustoner.
 */

export type TimbreId =
  | 'choir'
  | 'piano'
  | 'glockenspiel'
  | 'tuningFork'
  | 'flute'
  | 'ah'
  | 'oh';

export interface PartialSpec {
  /** Deltonens frekvens som multipel av grundtonen. */
  ratio: number;
  gain: number;
  /**
   * Hur snabbt deltonen tystnar jämfört med klangens grunddämpning. Under 1
   * betyder snabbare. Används bara av klanger som klingar av av sig själva.
   */
  decayScale?: number;
}

export interface Timbre {
  id: TimbreId;
  label: string;
  description: string;
  attack: number;
  /** Tid från full styrka ner till sustain-nivån. */
  decay: number;
  /** Nivån tonen ligger kvar på. Nära noll ger ett anslag som klingar av. */
  sustain: number;
  release: number;
  /**
   * Om satt klingar varje delton av på egen hand under så här lång tid, vilket
   * ger anslagsklanger deras naturliga förlopp där ljusa deltoner dör först.
   */
  partialDecay?: number;
  partials: (fundamental: number) => PartialSpec[];
}

const fixedPartials =
  (list: ReadonlyArray<PartialSpec>) => () => list as PartialSpec[];

/**
 * Formantmodell för vokaler: deltoner nära formanttopparna förstärks, övriga
 * dämpas. Det är formanternas läge, inte grundtonen, som gör att örat hör ett
 * «ah» eller ett «oh».
 */
function vowelPartials(
  formants: ReadonlyArray<{ frequency: number; amplitude: number; width: number }>,
  count = 14,
) {
  return (fundamental: number): PartialSpec[] => {
    const partials: PartialSpec[] = [];
    for (let harmonic = 1; harmonic <= count; harmonic += 1) {
      const frequency = fundamental * harmonic;
      let gain = 0;
      for (const formant of formants) {
        const distance = (frequency - formant.frequency) / formant.width;
        gain += formant.amplitude * Math.exp(-distance * distance);
      }
      // Golv för de sex första deltonerna. Dels så att tonhöjden hörs även när
      // ingen formant träffar, dels för att femman och sexan måste finnas kvar
      // för att skillnaden mellan tempererad och ren stämning ska höras — i en
      // mörk vokal som «oh» ligger de annars långt under alla formanter.
      gain += harmonic <= 6 ? Math.max(0.08, 0.2 / harmonic) : 0;
      if (gain > 0.02) {
        partials.push({ ratio: harmonic, gain });
      }
    }
    return partials;
  };
}

export const TIMBRES: Record<TimbreId, Timbre> = {
  choir: {
    id: 'choir',
    label: 'Körton',
    description: 'Jämn, orgelaktig ton som ligger kvar så länge du håller den.',
    attack: 0.015,
    decay: 0.12,
    sustain: 0.75,
    release: 0.35,
    partials: fixedPartials([
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.5 },
      { ratio: 3, gain: 0.35 },
      { ratio: 4, gain: 0.25 },
      { ratio: 5, gain: 0.22 },
      { ratio: 6, gain: 0.15 },
    ]),
  },

  piano: {
    id: 'piano',
    label: 'Piano',
    description: 'Anslag som klingar av, ungefär som en stämd flygel.',
    attack: 0.004,
    decay: 0.9,
    sustain: 0.12,
    release: 0.4,
    partialDecay: 2.6,
    partials: fixedPartials([
      { ratio: 1, gain: 1, decayScale: 1.4 },
      { ratio: 2, gain: 0.55, decayScale: 1 },
      { ratio: 3, gain: 0.32, decayScale: 0.8 },
      { ratio: 4, gain: 0.2, decayScale: 0.6 },
      { ratio: 5, gain: 0.16, decayScale: 0.5 },
      { ratio: 6, gain: 0.1, decayScale: 0.4 },
      { ratio: 8, gain: 0.05, decayScale: 0.3 },
    ]),
  },

  glockenspiel: {
    id: 'glockenspiel',
    label: 'Klockspel',
    description: 'Ljus metallklang med långt efterklang. Bär långt i en sal.',
    attack: 0.002,
    decay: 1.6,
    sustain: 0.05,
    release: 0.6,
    partialDecay: 3.2,
    partials: fixedPartials([
      { ratio: 1, gain: 1, decayScale: 1.5 },
      { ratio: 2, gain: 0.14, decayScale: 1 },
      { ratio: 3, gain: 0.5, decayScale: 0.9 },
      { ratio: 4, gain: 0.18, decayScale: 0.7 },
      { ratio: 5, gain: 0.34, decayScale: 0.6 },
      { ratio: 6, gain: 0.16, decayScale: 0.5 },
      // Lätt orenstämd hög delton ger metallens skimmer.
      { ratio: 8.24, gain: 0.1, decayScale: 0.35 },
    ]),
  },

  tuningFork: {
    id: 'tuningFork',
    label: 'Stämgaffel',
    description: 'Nästan ren ton, lugn och lätt att sjunga mot.',
    attack: 0.01,
    decay: 0.5,
    sustain: 0.55,
    release: 0.5,
    partials: fixedPartials([
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.07 },
      { ratio: 3, gain: 0.05 },
      { ratio: 4, gain: 0.035 },
      { ratio: 5, gain: 0.045 },
      { ratio: 6, gain: 0.03 },
    ]),
  },

  flute: {
    id: 'flute',
    label: 'Flöjt',
    description: 'Mjuk och rund, med långsamt anslag.',
    attack: 0.08,
    decay: 0.2,
    sustain: 0.8,
    release: 0.3,
    partials: fixedPartials([
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.3 },
      { ratio: 3, gain: 0.12 },
      { ratio: 4, gain: 0.07 },
      { ratio: 5, gain: 0.06 },
      { ratio: 6, gain: 0.035 },
    ]),
  },

  ah: {
    id: 'ah',
    label: 'Ah',
    description: 'Öppen vokal, som kören sjunger på «a».',
    attack: 0.05,
    decay: 0.2,
    sustain: 0.8,
    release: 0.3,
    partials: vowelPartials([
      { frequency: 730, amplitude: 1, width: 130 },
      { frequency: 1090, amplitude: 0.62, width: 160 },
      { frequency: 2440, amplitude: 0.24, width: 260 },
    ]),
  },

  oh: {
    id: 'oh',
    label: 'Oh',
    description: 'Sluten vokal, mörkare än «ah».',
    attack: 0.05,
    decay: 0.2,
    sustain: 0.8,
    release: 0.3,
    partials: vowelPartials([
      { frequency: 450, amplitude: 1, width: 110 },
      { frequency: 800, amplitude: 0.55, width: 140 },
      { frequency: 2600, amplitude: 0.16, width: 250 },
    ]),
  },
};

export const TIMBRE_ORDER: TimbreId[] = [
  'choir',
  'piano',
  'glockenspiel',
  'tuningFork',
  'flute',
  'ah',
  'oh',
];

export const DEFAULT_TIMBRE: TimbreId = 'choir';
