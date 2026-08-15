/**
 * Samplad flygel: Salamander Grand Piano V3.
 *
 * En Yamaha C5 inspelad av Alexander Holm med två mikrofoner ovanför
 * strängarna, licensierad CC-BY 3.0. Ett prov var liten ters över hela
 * klaviaturen, A0 till C8 — trettio prov. Tonerna däremellan görs genom att
 * spela närmaste prov fortare eller långsammare, som mest en och en halv
 * halvton, vilket är för lite för att klangen ska förvrängas hörbart.
 *
 * Tonhöjden blir exakt oavsett stämning: hastigheten räknas ur den begärda
 * frekvensen och inte ur ett halvtonsavstånd, så ren stämning träffar rätt.
 *
 * Proven ligger som de spelades in: Ogg Vorbis, redan komprimerat till en
 * sjättedel av rådata. Formatet valdes inte för att spara plats utan för att
 * det packas upp överallt appen finns — ljudmotorn bär libvorbis på både iOS
 * och Android, och webbläsarna klarar det själva.
 *
 * Bara början av varje prov behålls i minnet. Avkodat ljud lagras som
 * okomprimerad float32, och hela banken skulle väga nära hundra megabyte på
 * webben och det dubbla i mobilappen — trettio gånger filernas storlek, och
 * nästan allt av det utklingning som aldrig hinner spelas. Se PROVLÄNGD.
 *
 * Var proven finns skiljer sig åt mellan plattformarna, och det avgörs av
 * pianoprov.ts respektive pianoprov.native.ts: mobilappen buntar in hela
 * klaviaturen, webben hämtar körregistret. Skillnaden syns här bara som att
 * ett prov antingen har en adress att hämtas från eller ett modulnummer att
 * avkodas direkt.
 */
import type { AudioBufferLike, AudioContextLike } from './context.ts';
// Ändelsen står utskriven för Node, och plockas bort av Metro så att
// pianoprov.native.ts väljs i mobilbygget. Se metro.config.js.
import { PROV as PLATTFORMENS_PROV } from './pianoprov.ts';

/**
 * Ett prov, så som den ena eller andra plattformen levererar det: webben med
 * en adress att hämta, mobilappen med ett modulnummer att slå upp. Typen
 * beskriver båda, eftersom typkontrollen bara ser den ena filen åt gången.
 */
export type Prov =
  | { midi: number; url: string }
  | { midi: number; modul: number };

const PROV: Prov[] = PLATTFORMENS_PROV;

/**
 * Så mycket av varje prov som behålls.
 *
 * Längre än så hinner ingen ton spelas: ett ackord klingar i en sekund, och
 * den långsammaste tongivningen ger 1,38 sekunder per ton, plus ett släpp på
 * en fjärdedels sekund. Två sekunder lämnar marginal åt båda — se provet i
 * samplade.test.ts, som räknar fram kravet ur appens egna gränser.
 *
 * Undantaget är en hållen tangent, som förr klingade så länge provet räckte.
 * Den tystnar nu efter två sekunder.
 */
export const PROVLÄNGD = 2;

/** Uttoning i slutet, så att kapningen inte hörs som ett knäpp. */
const UTTONING = 0.15;

const A4 = 69;
export const provfrekvens = (midi: number) => 440 * Math.pow(2, (midi - A4) / 12);

/** MIDI-numren för de prov den här plattformen har. */
export const PROVTONER: number[] = PROV.map((p) => p.midi);

export interface Sampelbank {
  id: string;
  prov: Prov[];
}

/** Flygeln, med de prov plattformen bär. */
export const SALAMANDER: Sampelbank = { id: 'salamander', prov: PROV };

/**
 * Behåller början av ett prov och tonar ut slutet.
 *
 * Kapningen sker efter avkodningen, inte i filen: proven på disk är orörda i
 * full längd och full kvalitet. Det är bara minnet som krymper.
 */
function kapa(ctx: AudioContextLike, källa: AudioBufferLike): AudioBufferLike {
  const sr = källa.sampleRate;
  const längd = Math.min(källa.length, Math.round(PROVLÄNGD * sr));
  if (längd >= källa.length) {
    return källa;
  }

  const kanaler = källa.numberOfChannels ?? 1;
  const kort = ctx.createBuffer(kanaler, längd, sr);
  const toning = Math.min(längd, Math.round(UTTONING * sr));

  for (let k = 0; k < kanaler; k += 1) {
    const från = källa.getChannelData(k);
    const till = kort.getChannelData(k);
    for (let i = 0; i < längd; i += 1) {
      const kvar = längd - i;
      till[i] = kvar < toning ? från[i] * (kvar / toning) : från[i];
    }
  }
  return kort;
}

/** Färdigladdade prov, en uppsättning per ljudkontext och bank. */
const laddade = new WeakMap<object, Map<string, Map<number, AudioBufferLike>>>();
/** Pågående laddningar, så att samma bank inte hämtas två gånger. */
const påväg = new WeakMap<object, Map<string, Promise<void>>>();

function förKontext<T>(karta: WeakMap<object, Map<string, T>>, ctx: AudioContextLike) {
  let egen = karta.get(ctx as unknown as object);
  if (!egen) {
    egen = new Map();
    karta.set(ctx as unknown as object, egen);
  }
  return egen;
}

/** Proven som redan finns i minnet, eller null om banken inte laddats än. */
export function laddadeProv(
  ctx: AudioContextLike,
  bank: Sampelbank,
): Map<number, AudioBufferLike> | null {
  return förKontext(laddade, ctx).get(bank.id) ?? null;
}

/**
 * Hämtar och avkodar bankens prov. Anropas när klangen väljs, så att
 * tangenterna svarar direkt när de väl trycks ned.
 */
export function laddaBank(ctx: AudioContextLike, bank: Sampelbank): Promise<void> {
  const pågående = förKontext(påväg, ctx);
  const redan = pågående.get(bank.id);
  if (redan) {
    return redan;
  }

  const arbete = (async () => {
    const buffertar = new Map<number, AudioBufferLike>();
    await Promise.all(
      bank.prov.map(async (prov) => {
        // Webben hämtar sina prov över nätet och lämnar råbyten till
        // avkodaren. Mobilappen har dem redan i sig och lämnar i stället
        // modulnumret, som ljudmotorn slår upp och läser själv.
        const varifrån = 'url' in prov ? prov.url : `modul ${prov.modul}`;
        try {
          if ('url' in prov) {
            const svar = await fetch(prov.url);
            if (!svar.ok) {
              throw new Error(`${svar.status}`);
            }
            buffertar.set(
              prov.midi,
              kapa(ctx, await ctx.decodeAudioData(await svar.arrayBuffer())),
            );
          } else {
            buffertar.set(prov.midi, kapa(ctx, await ctx.decodeAudioData(prov.modul)));
          }
        } catch (fel) {
          // Ett prov som inte går att hämta ska inte stjälpa hela banken:
          // grannprovet får täcka tonen i stället.
          console.warn(`Provet ${varifrån} kunde inte laddas: ${String(fel)}`);
        }
      }),
    );
    förKontext(laddade, ctx).set(bank.id, buffertar);
  })();

  pågående.set(bank.id, arbete);
  return arbete;
}

/** Provet som ligger närmast en frekvens, och hur fort det ska spelas. */
export function väljProv(
  buffertar: Map<number, AudioBufferLike>,
  frekvens: number,
): { buffert: AudioBufferLike; hastighet: number } | null {
  if (buffertar.size === 0) {
    return null;
  }
  const önskad = A4 + 12 * Math.log2(frekvens / 440);
  let bästa: number | null = null;
  let minst = Infinity;
  for (const midi of buffertar.keys()) {
    const avstånd = Math.abs(midi - önskad);
    if (avstånd < minst) {
      minst = avstånd;
      bästa = midi;
    }
  }
  if (bästa === null) {
    return null;
  }
  return {
    buffert: buffertar.get(bästa)!,
    hastighet: frekvens / provfrekvens(bästa),
  };
}
