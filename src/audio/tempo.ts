/** Ren tempo-matematik, utan beroenden till ljud eller UI. */

export const MIN_BPM = 30;
export const MAX_BPM = 300;

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
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
