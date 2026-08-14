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

import type {
  AudioContextLike,
  AudioNodeLike,
  AudioBufferLike,
} from './context.ts';
import { fmRecept, renderaSträng, strängPartialer, strängTid } from './pianos.ts';

export type TimbreId =
  | 'choir'
  | 'piano'
  | 'pianoStrangar'
  | 'pianoFM'
  | 'pianoModell'
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
 * sinustoner — den som moduleras, eller spelas ur en färdigräknad buffert.
 */
export type RöstByggare = (
  ctx: AudioContextLike,
  frekvens: number,
  nu: number,
  toppnivå: number,
) => RöstBygge;

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
  /** Sätts av de klanger som bygger sin egen ljudgraf i stället för deltoner. */
  bygg?: RöstByggare;
}

const fixedPartials =
  (list: ReadonlyArray<PartialSpec>) => () => list as PartialSpec[];

/** Nivån en modulator ska ha vid en viss tidpunkt, aldrig exakt noll. */
const TYST = 0.0001;

/**
 * FM-pianot.
 *
 * Bärvågen är en ren sinuston. All klang uppstår av att dess frekvens rubbas
 * av två andra sinustoner, och av att djupet i den rubbningen faller undan
 * inom bråkdelen av en sekund. Det är därför tonen klarnar av: när
 * modulatorerna tystnat är det som återstår en ren ton, precis som en sträng
 * som klingat av sina övertoner.
 */
function byggFM(
  ctx: AudioContextLike,
  frekvens: number,
  nu: number,
  toppnivå: number,
): RöstBygge {
  const recept = fmRecept(frekvens);

  const bärvåg = ctx.createOscillator();
  bärvåg.type = 'sine';
  bärvåg.frequency.setValueAtTime(recept.bärvåg, nu);

  const ut = ctx.createGain();
  // Tonen klingar av av sig själv; enveloppen ovanför sköter bara släppet.
  ut.gain.setValueAtTime(toppnivå, nu);
  ut.gain.exponentialRampToValueAtTime(toppnivå * 0.02, nu + recept.tid);
  bärvåg.connect(ut);

  const källor: RöstBygge['källor'] = [bärvåg];
  const noder: RöstBygge['noder'] = [bärvåg, ut];

  for (const modulator of [recept.kropp, recept.anslag]) {
    if (!modulator) {
      continue;
    }
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(modulator.frekvens, nu);

    // Modulatorns nivå mäts i hertz: den läggs rakt på bärvågens frekvens.
    const djup = ctx.createGain();
    djup.gain.setValueAtTime(modulator.djup, nu);
    djup.gain.exponentialRampToValueAtTime(TYST, nu + modulator.tid);

    osc.connect(djup);
    djup.connect(bärvåg.frequency);
    källor.push(osc);
    noder.push(osc, djup);
  }

  return { utgång: ut, källor, noder };
}

/**
 * Färdigräknade strängar, en per ljudkontext och tonhöjd.
 *
 * Att räkna fram en sträng tar några millisekunder, och samma ton begärs om
 * och om igen under en repetition. Bufferten hör till sin kontext, därför en
 * karta per kontext — stängs den tas hela kartan bort med den.
 */
const strängbuffertar = new WeakMap<object, Map<string, AudioBufferLike>>();

/**
 * Så många framräknade toner sparas. En bastons buffert är nära en megabyte,
 * och en kör rör sig ändå bara mellan en handfull tonhöjder under en
 * repetition. Den som legat längst tas bort först.
 */
const SPARADE_STRÄNGAR = 24;

function strängBuffert(ctx: AudioContextLike, frekvens: number): AudioBufferLike {
  let förKontext = strängbuffertar.get(ctx as unknown as object);
  if (!förKontext) {
    förKontext = new Map();
    strängbuffertar.set(ctx as unknown as object, förKontext);
  }
  // Tiondels hertz räcker som nyckel: ren och tempererad stämning skiljer
  // sig mer än så, och örat hör inte mindre.
  const nyckel = frekvens.toFixed(1);
  const färdig = förKontext.get(nyckel);
  if (färdig) {
    // Läs om den, så att den räknas som nyligen använd.
    förKontext.delete(nyckel);
    förKontext.set(nyckel, färdig);
    return färdig;
  }
  while (förKontext.size >= SPARADE_STRÄNGAR) {
    const äldst = förKontext.keys().next().value;
    if (äldst === undefined) {
      break;
    }
    förKontext.delete(äldst);
  }

  const data = renderaSträng(frekvens, ctx.sampleRate);
  const buffert = ctx.createBuffer(1, data.length, ctx.sampleRate);
  if (buffert.copyToChannel) {
    buffert.copyToChannel(data, 0);
  } else {
    buffert.getChannelData(0).set(data);
  }
  förKontext.set(nyckel, buffert);
  return buffert;
}

/**
 * Modellpianot: strängen räknas fram som ljuddata och spelas som ett prov.
 *
 * Ljudprovet är alltså inte inspelat utan uträknat, tonen som begärdes och
 * ingen annan. Därför behövs ingen transponering — och därmed inget av det
 * som annars gör transponerade prov onaturliga, där hela klangen glider med
 * tonhöjden i stället för att stå kvar där instrumentet har den.
 */
function byggModell(
  ctx: AudioContextLike,
  frekvens: number,
  nu: number,
  toppnivå: number,
): RöstBygge {
  const spelare = ctx.createBufferSource();
  spelare.buffer = strängBuffert(ctx, frekvens);

  const ut = ctx.createGain();
  ut.gain.setValueAtTime(toppnivå, nu);
  spelare.connect(ut);

  return { utgång: ut, källor: [spelare], noder: [spelare, ut] };
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

  /**
   * FÖRSÖK 1: strängarna beskrivna delton för delton.
   * Se pianos.ts för vad som gör en pianodelton till en pianodelton.
   */
  pianoStrangar: {
    id: 'pianoStrangar',
    label: 'Flygel — strängar',
    description:
      'Sexton deltoner på sina verkliga, sträckta lägen, var och en med sin egen utklingning, och de lägsta dubblerade som en tongrupps strängar. Trognast av de tre, och tyngst att spela.',
    attack: 0.002,
    decay: 0.01,
    // Utklingningen sköts av varje delton för sig, inte av enveloppen.
    sustain: 1,
    release: 0.28,
    revealsTuning: true,
    // Deltonernas tider anges i hela sekunder, därför faktorn ett.
    partialDecay: 1,
    partials: strängPartialer,
  },

  /** FÖRSÖK 2: frekvensmodulering, som i DX7:ans klassiska pianoklang. */
  pianoFM: {
    id: 'pianoFM',
    label: 'Flygel — FM',
    description:
      'Två modulatorer på en bärvåg, med moduleringsdjup som faller undan. Ljust i anslaget och mjukt en halv sekund senare — samma knep som elpianot från 1983, och det billigaste av de tre.',
    attack: 0.002,
    decay: 0.01,
    sustain: 1,
    release: 0.25,
    revealsTuning: true,
    partials: fixedPartials([{ ratio: 1, gain: 1 }]),
    bygg: byggFM,
  },

  /** FÖRSÖK 3: en fysikalisk sträng, framräknad till ett ljudprov. */
  pianoModell: {
    id: 'pianoModell',
    label: 'Flygel — modell',
    description:
      'En hammare som slår an en modellerad sträng. Tonen räknas fram till ett ljudprov första gången den behövs, och spelas sedan som en inspelning. Här beskrivs inte klangen utan strängen — utklingningen kommer av sig själv.',
    attack: 0.002,
    decay: 0.01,
    sustain: 1,
    release: 0.22,
    revealsTuning: true,
    partials: fixedPartials([{ ratio: 1, gain: 1 }]),
    bygg: byggModell,
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
  'pianoStrangar',
  'pianoFM',
  'pianoModell',
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
