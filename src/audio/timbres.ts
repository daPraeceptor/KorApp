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
  | 'tuningFork'
  | 'flute'
  | 'sine';

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
  /**
   * Om klangen bär de deltoner som svävar mot varandra, och alltså kan visa
   * skillnaden mellan tempererad och ren stämning. Falskt för sinustonen, som
   * saknar övertoner helt och därför inte kan sväva mot något.
   */
  revealsTuning: boolean;
  partials: (fundamental: number) => PartialSpec[];
}

const fixedPartials =
  (list: ReadonlyArray<PartialSpec>) => () => list as PartialSpec[];

export const TIMBRES: Record<TimbreId, Timbre> = {
  choir: {
    id: 'choir',
    label: 'Körton',
    description: 'Jämn, orgelaktig ton som ligger kvar så länge du håller den.',
    attack: 0.015,
    decay: 0.12,
    sustain: 0.75,
    release: 0.35,
    revealsTuning: true,
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
    revealsTuning: true,
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

  tuningFork: {
    id: 'tuningFork',
    label: 'Stämgaffel',
    description: 'Nästan ren ton, lugn och lätt att sjunga mot.',
    attack: 0.01,
    decay: 0.5,
    sustain: 0.55,
    release: 0.5,
    revealsTuning: true,
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
    revealsTuning: true,
    partials: fixedPartials([
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.3 },
      { ratio: 3, gain: 0.12 },
      { ratio: 4, gain: 0.07 },
      { ratio: 5, gain: 0.06 },
      { ratio: 6, gain: 0.035 },
    ]),
  },

  sine: {
    id: 'sine',
    label: 'Sinus',
    description:
      'Ren sinuston utan övertoner. Mjukast tänkbara klang — men skillnaden mellan tempererad och ren stämning hörs inte.',
    attack: 0.02,
    decay: 0.2,
    sustain: 0.85,
    release: 0.35,
    revealsTuning: false,
    partials: fixedPartials([{ ratio: 1, gain: 1 }]),
  },
};

export const TIMBRE_ORDER: TimbreId[] = [
  'choir',
  'piano',
  'tuningFork',
  'flute',
  'sine',
];

export const DEFAULT_TIMBRE: TimbreId = 'choir';

/**
 * Hämtar en klang och faller tillbaka på standard om id:t inte finns.
 * Lagringen kan innehålla en klang som tagits bort i en senare version.
 */
export function timbreOr(id: TimbreId | string): Timbre {
  return TIMBRES[id as TimbreId] ?? TIMBRES[DEFAULT_TIMBRE];
}
