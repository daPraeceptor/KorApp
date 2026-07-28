/**
 * Stämning och tonhöjder.
 *
 * Två stämningssystem stöds:
 *  - Liksvävande temperering ("tempererad"): alla halvtoner lika stora, som ett piano.
 *  - Ren stämning ("svävningsfri"): intervallen byggs av heltalskvoter relativt en tonika,
 *    vilket gör att övertonerna sammanfaller och svävningarna försvinner.
 */

export type TuningSystem = 'tempered' | 'just';

/** Tonnamn: svensk notation använder H för internationellt B, och B för Bess. */
export type NoteNaming = 'swedish' | 'international';

export const SEMITONES_PER_OCTAVE = 12;

/** MIDI-nummer för A4 (kammartonen). */
export const A4_MIDI = 69;

export const DEFAULT_A4 = 440;

const SWEDISH_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'B',
  'H',
] as const;

const INTERNATIONAL_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;

/**
 * Rena intervallkvoter i 5-limit, indexerade på antal halvtoner över tonikan.
 * Detta är den uppsättning körer normalt sjunger: ren ters 5/4, ren kvint 3/2.
 */
export const JUST_RATIOS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], // prim
  [16, 15], // liten sekund
  [9, 8], // stor sekund
  [6, 5], // liten ters
  [5, 4], // stor ters
  [4, 3], // kvart
  [45, 32], // tritonus
  [3, 2], // kvint
  [8, 5], // liten sext
  [5, 3], // stor sext
  [9, 5], // liten septim
  [15, 8], // stor septim
];

export const INTERVAL_NAMES = [
  'Prim',
  'Liten sekund',
  'Stor sekund',
  'Liten ters',
  'Stor ters',
  'Kvart',
  'Tritonus',
  'Kvint',
  'Liten sext',
  'Stor sext',
  'Liten septim',
  'Stor septim',
] as const;

/** Halvtonssteg inom oktaven som ritas som svarta tangenter. */
const BLACK_KEY_STEPS = new Set([1, 3, 6, 8, 10]);

export function isBlackKey(midi: number): boolean {
  return BLACK_KEY_STEPS.has(pitchClass(midi));
}

/** Tonklass 0–11, där 0 = C. Fungerar även för negativa tal. */
export function pitchClass(midi: number): number {
  return ((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
}

/** Oktavnummer enligt vetenskaplig notation, där MIDI 60 = C4. */
export function octaveOf(midi: number): number {
  return Math.floor(midi / SEMITONES_PER_OCTAVE) - 1;
}

export function noteName(midi: number, naming: NoteNaming = 'international'): string {
  const names = naming === 'swedish' ? SWEDISH_NAMES : INTERNATIONAL_NAMES;
  return names[pitchClass(midi)];
}

export function noteNameWithOctave(midi: number, naming: NoteNaming = 'international'): string {
  return `${noteName(midi, naming)}${octaveOf(midi)}`;
}

/** Alla tolv tonnamn i ordning från C. */
export function allNoteNames(naming: NoteNaming = 'international'): readonly string[] {
  return naming === 'swedish' ? SWEDISH_NAMES : INTERNATIONAL_NAMES;
}

/** Frekvens i liksvävande temperering. */
export function temperedFrequency(midi: number, a4: number = DEFAULT_A4): number {
  return a4 * Math.pow(2, (midi - A4_MIDI) / SEMITONES_PER_OCTAVE);
}

/**
 * Frekvens i ren stämning relativt en tonika.
 *
 * Tonikan själv förankras på sin tempererade frekvens, så att den låter likadant
 * oavsett stämningssystem — körledaren ger tonikan från en fast referens och
 * övriga toner justeras runt den.
 */
export function justFrequency(
  midi: number,
  tonicPitchClass: number,
  a4: number = DEFAULT_A4,
): number {
  const tonicPc = pitchClass(tonicPitchClass);
  // Oktavläget för ankaret spelar ingen roll: kvoterna skalas ändå med 2^oktaver.
  const tonicMidi = 60 + tonicPc;
  const tonicFreq = temperedFrequency(tonicMidi, a4);

  const distance = midi - tonicMidi;
  const octaves = Math.floor(distance / SEMITONES_PER_OCTAVE);
  const step = distance - octaves * SEMITONES_PER_OCTAVE;

  const [numerator, denominator] = JUST_RATIOS[step];
  return (tonicFreq * numerator * Math.pow(2, octaves)) / denominator;
}

export interface TuningConfig {
  system: TuningSystem;
  /** Tonklass 0–11 för tonikan. Används bara i ren stämning. */
  tonicPitchClass: number;
  /** Referensfrekvens för kammartonen A4. */
  a4: number;
}

export const DEFAULT_TUNING: TuningConfig = {
  system: 'tempered',
  tonicPitchClass: 0,
  a4: DEFAULT_A4,
};

export function frequencyOf(midi: number, tuning: TuningConfig): number {
  return tuning.system === 'just'
    ? justFrequency(midi, tuning.tonicPitchClass, tuning.a4)
    : temperedFrequency(midi, tuning.a4);
}

/** Skillnad i cent mellan två frekvenser. 100 cent = en tempererad halvton. */
export function centsBetween(from: number, to: number): number {
  return 1200 * Math.log2(to / from);
}

/**
 * Hur många cent tonen avviker från sin tempererade motsvarighet.
 * Noll i tempererad stämning; i ren stämning t.ex. −13.7 för en stor ters.
 */
export function centsFromTempered(midi: number, tuning: TuningConfig): number {
  return centsBetween(temperedFrequency(midi, tuning.a4), frequencyOf(midi, tuning));
}

/** Antal halvtoner över tonikan, reducerat till en oktav. */
export function scaleDegree(midi: number, tonicPitchClass: number): number {
  return pitchClass(midi - tonicPitchClass);
}

export function intervalName(midi: number, tonicPitchClass: number): string {
  return INTERVAL_NAMES[scaleDegree(midi, tonicPitchClass)];
}

export function ratioLabel(midi: number, tonicPitchClass: number): string {
  const [numerator, denominator] = JUST_RATIOS[scaleDegree(midi, tonicPitchClass)];
  return `${numerator}/${denominator}`;
}
