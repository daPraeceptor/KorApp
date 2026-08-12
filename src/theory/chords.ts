/**
 * Ackordanalys och enharmonisk stavning.
 *
 * Samma tangent kan heta två saker — C♯ eller D♭ — och vilket som är rätt
 * beror på ackordet omkring den. Modulen svarar på två frågor: vad heter
 * ackordet, och hur ska varje ton stavas för att notbilden ska bli enklast?
 *
 * "Enklast" mäts som antalet förtecken i tonarten. D♭-dur har fem b, medan
 * C♯-dur har sju kors — alltså skriver vi D♭. Men C♯-moll har fyra kors mot
 * D♭-molls åtta b, så där vinner C♯. Regeln ger av sig själv den stavning
 * körvärlden är van vid: C♯, E♭, F♯, A♭, B♭.
 */
import { SEMITONES_PER_OCTAVE, pitchClass } from './tuning.ts';
import type { NoteNaming } from './tuning.ts';

/** Med kors (♯) eller med b (♭). */
export type Stavning = 'sharp' | 'flat';

/**
 * Grundbokstaven och tecknet för varje tonklass i båda stavningarna.
 * Svenskan skiljer sig på två ställen: tonklass 10 heter B och 11 heter H.
 */
const KORS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const B_STAVNING = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/** Tonklasser utan svarta tangenter behöver ingen växling. */
export function ärSvartTangent(pc: number): boolean {
  return [1, 3, 6, 8, 10].includes(((pc % 12) + 12) % 12);
}

/**
 * Så stavas en lös ton utan ackord omkring sig: C♯, E♭, F♯, A♭, B♭. Det är
 * de namn körvärlden använder när tonen står för sig själv, och de skiljer
 * sig från vad ren tonartsräkning skulle ge — D♭ har färre förtecken än C♯
 * som tonart, men en ensam svart tangent mellan C och D kallas C♯.
 */
const FÖRVAL: Stavning[] = [
  'sharp', // C
  'sharp', // C♯
  'sharp', // D
  'flat', // E♭
  'sharp', // E
  'sharp', // F
  'sharp', // F♯
  'sharp', // G
  'flat', // A♭
  'sharp', // A
  'flat', // B♭
  'sharp', // B/H
];

/** Förvald stavning för en ton som står utan ackordsammanhang. */
export function standardStavning(pc: number): Stavning {
  return FÖRVAL[((pc % 12) + 12) % 12];
}

/**
 * Tonens namn i vald stavning. Svenskan byter B mot H, och kallar det
 * internationella B♭ för B — därför översätts namnen sist.
 */
export function tonNamn(
  pc: number,
  stavning: Stavning,
  naming: NoteNaming = 'international',
): string {
  const i = ((pc % 12) + 12) % 12;
  const namn = stavning === 'flat' ? B_STAVNING[i] : KORS[i];
  if (naming !== 'swedish') {
    return namn;
  }
  // Svensk notation: H är den vita tangenten, B är den under den.
  if (i === 11) return 'H';
  if (i === 10) return stavning === 'flat' ? 'B' : 'A♯';
  return namn;
}

/**
 * Antal förtecken i tonarten med den här grundtonen, räknat i kvintcirkeln.
 * Positivt betyder kors, negativt b. Moll räknas från sin parallelldur.
 */
function förtecken(pc: number, moll: boolean, stavning: Stavning): number {
  // Kvintcirkeln i kors räknat från C: C G D A E B F♯ C♯ ...
  const kvintsteg = [0, 2, 4, -1, 1, 3, 5][
    ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(
      (stavning === 'flat' ? B_STAVNING : KORS)[((pc % 12) + 12) % 12][0],
    )
  ];
  const tecken = (stavning === 'flat' ? B_STAVNING : KORS)[
    ((pc % 12) + 12) % 12
  ].slice(1);
  const justering = tecken === '♯' ? 7 : tecken === '♭' ? -7 : 0;
  // Moll ligger tre kvintsteg lägre än sin parallelldur.
  return kvintsteg + justering + (moll ? -3 : 0);
}

/** Den stavning som ger färst förtecken. Vid lika vinner kors. */
export function enklasteStavning(pc: number, moll = false): Stavning {
  if (!ärSvartTangent(pc)) {
    return 'sharp';
  }
  const medKors = Math.abs(förtecken(pc, moll, 'sharp'));
  const medB = Math.abs(förtecken(pc, moll, 'flat'));
  return medB < medKors ? 'flat' : 'sharp';
}

/** Ackordtyper vi känner igen, med sina intervall över grundtonen. */
const TYPER: { intervall: number[]; suffix: string; moll: boolean }[] = [
  { intervall: [0, 4, 7], suffix: '', moll: false },
  { intervall: [0, 3, 7], suffix: 'm', moll: true },
  { intervall: [0, 3, 6], suffix: 'dim', moll: true },
  { intervall: [0, 4, 8], suffix: 'aug', moll: false },
  { intervall: [0, 5, 7], suffix: 'sus4', moll: false },
  { intervall: [0, 2, 7], suffix: 'sus2', moll: false },
  { intervall: [0, 4, 7, 10], suffix: '7', moll: false },
  { intervall: [0, 4, 7, 11], suffix: 'maj7', moll: false },
  { intervall: [0, 3, 7, 10], suffix: 'm7', moll: true },
  { intervall: [0, 3, 6, 10], suffix: 'm7♭5', moll: true },
  { intervall: [0, 3, 6, 9], suffix: 'dim7', moll: true },
  // Två toner räcker inte för ett ackord, men kvinten och tersen säger ändå
  // något — de tas med sist så att fullständiga ackord alltid vinner.
  { intervall: [0, 7], suffix: '5', moll: false },
];

export interface Ackord {
  /** Ackordets namn, eller null när tonerna inte bildar något känt. */
  namn: string | null;
  /** Grundtonens tonklass, eller null när ackordet inte gick att tyda. */
  grund: number | null;
  /** Stavningen varje tonklass i ackordet ska skrivas med. */
  stavning: Map<number, Stavning>;
}

/**
 * Tyder tonerna som ett ackord och väljer stavning därefter.
 *
 * @param toner MIDI-toner i valfri ordning och oktav.
 * @param grundton Vald grundton som tonklass, eller null. Är den satt och
 *                 ingår i ackordet vinner den som grundton — körledaren vet
 *                 bättre än räkningen vad stycket står i.
 */
export function analyseraAckord(
  toner: number[],
  grundton: number | null = null,
): Ackord {
  const klasser = [...new Set(toner.map(pitchClass))].sort((a, b) => a - b);
  const tomt: Ackord = { namn: null, grund: null, stavning: new Map() };
  if (klasser.length === 0) {
    return tomt;
  }

  // En ensam ton är ingen harmoni, men den ska ändå stavas — då gäller
  // förvalet, inte tonartsräkningen.
  if (klasser.length === 1) {
    const pc = klasser[0];
    return { namn: null, grund: pc, stavning: new Map([[pc, standardStavning(pc)]]) };
  }

  // Pröva varje ton som tänkbar grundton, i den ordning som gör en vald
  // grundton till förstahandsval.
  const kandidater = [...klasser].sort((a, b) => {
    if (grundton !== null && a === grundton) return -1;
    if (grundton !== null && b === grundton) return 1;
    return 0;
  });

  for (const grund of kandidater) {
    const intervall = klasser
      .map((pc) => ((pc - grund) % SEMITONES_PER_OCTAVE + SEMITONES_PER_OCTAVE)
        % SEMITONES_PER_OCTAVE)
      .sort((a, b) => a - b);
    for (const typ of TYPER) {
      if (
        typ.intervall.length === intervall.length &&
        typ.intervall.every((steg, i) => steg === intervall[i])
      ) {
        const stavning = enklasteStavning(grund, typ.moll);
        const karta = new Map<number, Stavning>();
        // Hela ackordet skrivs i grundtonens värld: står ackordet i b-tonart
        // skrivs också dess övriga svarta tangenter med b.
        for (const pc of klasser) {
          karta.set(pc, ärSvartTangent(pc) ? stavning : 'sharp');
        }
        return {
          namn: `${tonNamn(grund, stavning)}${typ.suffix}`,
          grund,
          stavning: karta,
        };
      }
    }
  }

  // Ingen känd harmoni: varje ton stavas för sig enligt förvalet.
  const karta = new Map<number, Stavning>();
  for (const pc of klasser) {
    karta.set(pc, standardStavning(pc));
  }
  return { namn: null, grund: null, stavning: karta };
}
