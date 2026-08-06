/**
 * Underdelningar av taktslaget.
 *
 * Varje underdelning beskrivs av klickens lägen inom taktslaget, som andelar
 * mellan 0 och 1. Det är nödvändigt eftersom swing och punkterade figurer är
 * ojämnt fördelade — en modell som bara räknar «antal klick per slag» klarar
 * bara de jämna.
 */

export type SubdivisionId =
  | 'quarter'
  | 'eighth'
  | 'triplet'
  | 'sixteenth'
  | 'swing8'
  | 'dotted8'
  | 'swing16'
  | 'quintuplet';

export interface Subdivision {
  id: SubdivisionId;
  label: string;
  /** Kort förklaring, visas i inställningarna. */
  description: string;
  /** Avancerade döljs tills körledaren slår på dem. */
  advanced: boolean;
  /**
   * Klickens lägen inom taktslaget. Första är alltid 0 — det är slaget självt.
   * Övriga är underdelningar och klickar svagare.
   */
  offsets: number[];
}

const TREDJEDEL = 1 / 3;

export const SUBDIVISIONS: Record<SubdivisionId, Subdivision> = {
  quarter: {
    id: 'quarter',
    label: 'Fjärdedelar',
    description: 'Ett klick per taktslag.',
    advanced: false,
    offsets: [0],
  },
  eighth: {
    id: 'eighth',
    label: 'Åttondelar',
    description: 'Två jämna klick per taktslag.',
    advanced: false,
    offsets: [0, 1 / 2],
  },
  triplet: {
    id: 'triplet',
    label: 'Trioler',
    description: 'Tre jämna klick per taktslag.',
    advanced: false,
    offsets: [0, TREDJEDEL, 2 * TREDJEDEL],
  },
  sixteenth: {
    id: 'sixteenth',
    label: 'Sextondelar',
    description: 'Fyra jämna klick per taktslag.',
    advanced: false,
    offsets: [0, 1 / 4, 1 / 2, 3 / 4],
  },

  swing8: {
    id: 'swing8',
    label: 'Swing 8',
    description:
      'Åttondelsswing. Andra klicket ligger på trioldelningens sista tredjedel — lång, kort.',
    advanced: true,
    // Två tredjedelar in: samma läge som triolens tredje del.
    offsets: [0, 2 * TREDJEDEL],
  },
  dotted8: {
    id: 'dotted8',
    label: 'Punkterat',
    description:
      'Punkterad åttondel och sextondel. Hårdare gungning än swing, eftersom andra klicket kommer senare.',
    advanced: true,
    offsets: [0, 3 / 4],
  },
  swing16: {
    id: 'swing16',
    label: 'Swing 16',
    description:
      'Sextondelsswing. Varje åttondelspar gungar för sig, alltså fyra klick där andra och fjärde ligger sent.',
    advanced: true,
    // Halvorna gungar var för sig: 0 och 1/3 i första, 1/2 och 5/6 i andra.
    offsets: [0, TREDJEDEL, 1 / 2, 1 / 2 + TREDJEDEL],
  },
  quintuplet: {
    id: 'quintuplet',
    label: 'Kvintol',
    description: 'Fem jämna klick per taktslag.',
    advanced: true,
    offsets: [0, 1 / 5, 2 / 5, 3 / 5, 4 / 5],
  },
};

export const SUBDIVISION_ORDER: SubdivisionId[] = [
  'quarter',
  'eighth',
  'triplet',
  'sixteenth',
  'swing8',
  'dotted8',
  'swing16',
  'quintuplet',
];

export const DEFAULT_SUBDIVISION: SubdivisionId = 'quarter';

/**
 * Underdelningen sparades tidigare som antalet klick per slag. Äldre låtar och
 * inställningar läses därför fortfarande som siffror.
 */
const FRÅN_SIFFRA: Record<number, SubdivisionId> = {
  1: 'quarter',
  2: 'eighth',
  3: 'triplet',
  4: 'sixteenth',
};

export function toSubdivisionId(värde: unknown): SubdivisionId {
  if (typeof värde === 'string' && värde in SUBDIVISIONS) {
    return värde as SubdivisionId;
  }
  if (typeof värde === 'number' && Number.isFinite(värde)) {
    return FRÅN_SIFFRA[Math.round(värde)] ?? DEFAULT_SUBDIVISION;
  }
  return DEFAULT_SUBDIVISION;
}

export function subdivisionOr(id: SubdivisionId | string): Subdivision {
  return SUBDIVISIONS[id as SubdivisionId] ?? SUBDIVISIONS[DEFAULT_SUBDIVISION];
}
