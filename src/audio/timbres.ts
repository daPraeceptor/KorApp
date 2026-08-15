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

import type { AudioContextLike, AudioNodeLike } from './context.ts';
import { STANDARDKLANG } from './standardklang.ts';
import {
  SALAMANDER,
  type Sampelbank,
  laddaBank,
  laddadeProv,
  väljProv,
} from './samplade.ts';

export type TimbreId =
  | 'choir'
  | 'salamander'
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

/** En färdigbyggd röst, redo att hängas under tonens envelopp. */
export interface RöstBygge {
  /** Noden som ska kopplas till enveloppen. */
  utgång: AudioNodeLike;
  /** Allt som ska startas när tonen börjar och stoppas när den släpps. */
  källor: { start(when?: number): void; stop(when?: number): void }[];
  /** Allt som ska kopplas loss när tonen tystnat. */
  noder: { disconnect(): void }[];
}

/**
 * Bygger tonens ljudgraf åt en klang som inte går att beskriva som en hög
 * sinustoner — den som moduleras, eller spelas ur ett inspelat prov.
 *
 * Null betyder att klangen inte kan ljuda än, till exempel för att proven
 * fortfarande hämtas. Då blir tonen tyst i stället för fel.
 */
export type RöstByggare = (
  ctx: AudioContextLike,
  frekvens: number,
  nu: number,
  toppnivå: number,
) => RöstBygge | null;

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
  /**
   * Klangens egen styrka, så att alla upplevs lika starka.
   *
   * Deltoner som ligger tätt förstärker varandra: en ren sinuston blir nästan
   * sex gånger starkare än en inspelad flygelton fast båda får samma toppnivå
   * av ljudmotorn. Talen här är mätta som RMS över en halv sekund vid C4 och
   * satta så att alla hamnar på samma upplevda nivå.
   */
  nivå?: number;
  partials: (fundamental: number) => PartialSpec[];
  /** Sätts av de klanger som bygger sin egen ljudgraf i stället för deltoner. */
  bygg?: RöstByggare;
  /**
   * Hämtar det klangen behöver innan den kan ljuda. Anropas när klangen väljs,
   * så att tangenterna svarar direkt när de väl trycks ned.
   */
  förbered?: (ctx: AudioContextLike) => Promise<void>;
}

const fixedPartials =
  (list: ReadonlyArray<PartialSpec>) => () => list as PartialSpec[];

/**
 * En klang som spelar inspelade prov.
 *
 * Tonen mellan två prov görs genom att spela det närmaste provet fortare
 * eller långsammare. Hastigheten räknas ur den begärda frekvensen, så att
 * ren stämning träffar exakt.
 */
function byggProv(bank: Sampelbank): RöstByggare {
  return (ctx, frekvens, nu, toppnivå) => {
    const buffertar = laddadeProv(ctx, bank);
    if (!buffertar) {
      // Proven är inte här än. Sätt igång hämtningen och låt tonen vara tyst
      // den här gången — nästa tryck hörs.
      void laddaBank(ctx, bank);
      return null;
    }
    const val = väljProv(buffertar, frekvens);
    if (!val) {
      return null;
    }

    const spelare = ctx.createBufferSource();
    spelare.buffer = val.buffert;
    spelare.playbackRate.value = val.hastighet;

    const ut = ctx.createGain();
    ut.gain.setValueAtTime(toppnivå, nu);
    spelare.connect(ut);

    return { utgång: ut, källor: [spelare], noder: [spelare, ut] };
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
    // uppmätt 0,137
    nivå: 0.95,
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

  /**
   * Inspelad flygel. Ett prov var liten ters, se samplade.ts för hur tonerna
   * däremellan görs.
   */
  salamander: {
    id: 'salamander',
    label: 'Flygel',
    description:
      'Inspelad Yamaha C5 — Salamander Grand Piano av Alexander Holm, CC-BY 3.0. Hela utklingningen som den spelades in.',
    attack: 0.002,
    decay: 0.01,
    // Provet bär sin egen utklingning; enveloppen sköter bara släppet.
    sustain: 1,
    release: 0.25,
    // uppmätt 0,054 — provet är inspelat måttligt och har utrymme kvar
    nivå: 2.4,
    revealsTuning: true,
    partials: fixedPartials([{ ratio: 1, gain: 1 }]),
    bygg: byggProv(SALAMANDER),
    förbered: (ctx) => laddaBank(ctx, SALAMANDER),
  },

  tuningFork: {
    id: 'tuningFork',
    label: 'Stämgaffel',
    description: 'Nästan ren ton, lugn och lätt att sjunga mot.',
    attack: 0.01,
    decay: 0.5,
    sustain: 0.55,
    release: 0.5,
    // uppmätt 0,227
    nivå: 0.57,
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
    // uppmätt 0,191
    nivå: 0.68,
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
    // uppmätt 0,309 — tätast av alla, och därför starkast
    nivå: 0.42,
    revealsTuning: false,
    partials: fixedPartials([{ ratio: 1, gain: 1 }]),
  },
};

export const TIMBRE_ORDER: TimbreId[] = [
  'salamander',
  'choir',
  'tuningFork',
  'flute',
  'sine',
];

/**
 * Klangen appen börjar i. Skiljer sig mellan plattformarna: mobilappen bär
 * flygelns prov i sig och börjar därför i den, medan webben börjar i körtonen
 * för att slippa hämta tre megabyte innan någon bett om en ton.
 *
 * Ändelsen står utskriven för Node och plockas bort av Metro, som därmed
 * väljer standardklang.native.ts i mobilbygget. Se metro.config.js.
 */
export const DEFAULT_TIMBRE: TimbreId = STANDARDKLANG;

/**
 * Hämtar en klang och faller tillbaka på standard om id:t inte finns.
 * Lagringen kan innehålla en klang som tagits bort i en senare version.
 */
export function timbreOr(id: TimbreId | string): Timbre {
  return TIMBRES[id as TimbreId] ?? TIMBRES[DEFAULT_TIMBRE];
}
