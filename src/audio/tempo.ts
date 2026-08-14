/** Ren tempo-matematik, utan beroenden till ljud eller UI. */

export const MIN_BPM = 30;
export const MAX_BPM = 300;
export const DEFAULT_BPM = 90;

export const MIN_BEATS_PER_BAR = 1;
/**
 * Spelvyn erbjuder ett till tolv slag per takt. Gränsen här är satt högre än
 * så, eftersom den bara ska fånga det orimliga — ett bibliotek skrivet av en
 * annan version ska få behålla sin taktart, inte klippas ner till vyns urval.
 */
export const MAX_BEATS_PER_BAR = 32;

/**
 * Tempot inom sina gränser, som ett helt tal.
 *
 * Ett värde som inte är ett tal blir standardtempot i stället för att smitta
 * vidare: NaN överlever både Math.max och Math.min, och en metronom med NaN
 * mellan slagen skulle aldrig komma fram till nästa taktslag.
 */
export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) {
    return DEFAULT_BPM;
  }
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/** Antal slag per takt inom sina gränser, som ett helt tal. */
export function clampBeatsPerBar(beats: number): number {
  if (!Number.isFinite(beats)) {
    return 4;
  }
  return Math.min(MAX_BEATS_PER_BAR, Math.max(MIN_BEATS_PER_BAR, Math.round(beats)));
}

/**
 * Räknar ut tempo ur tidpunkterna för användarens knacktempo.
 * Tar bort avvikande knackningar så att en missad takt inte förstör medelvärdet.
 */
export function tempoFromTaps(timestampsMs: number[]): number | null {
  if (timestampsMs.length < 2) {
    return null;
  }

  const intervals: number[] = [];
  for (let i = 1; i < timestampsMs.length; i += 1) {
    intervals.push(timestampsMs[i] - timestampsMs[i - 1]);
  }

  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const consistent = intervals.filter(
    (interval) => Math.abs(interval - median) <= median * 0.35,
  );

  const used = consistent.length > 0 ? consistent : intervals;
  const average = used.reduce((sum, value) => sum + value, 0) / used.length;
  if (average <= 0) {
    return null;
  }
  return clampBpm(60000 / average);
}
