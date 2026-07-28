/**
 * Låtbiblioteket: tempo, taktart, stämning och starttoner sparade per låt.
 */
import type { TuningSystem } from '../theory/tuning';

/**
 * Hur låtens toner hålls i ordning.
 *
 * 'pitch' lägger dem efter tonhöjd. 'entry' behåller den ordning körledaren
 * valde dem i, till exempel stämmornas insatsordning, och då är följden
 * betydelsebärande — därför sorteras den varken vid inläsning eller uppspelning.
 */
export type ToneOrder = 'pitch' | 'entry';

export interface Song {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  subdivision: number;
  tuningSystem: TuningSystem;
  /** Tonklass 0–11 för låtens tonika. */
  tonicPitchClass: number;
  /** MIDI-nummer för de toner kören ska få. Ordningen kan vara betydelsebärande. */
  tones: number[];
  /** Hur snabbt tonerna ges en i taget, i slag per minut. */
  toneGapBpm: number;
  notes: string;
  updatedAt: number;
}

export const MIN_TONE_GAP_BPM = 20;
export const MAX_TONE_GAP_BPM = 200;
export const DEFAULT_TONE_GAP_BPM = 80;

export const MAX_TONES = 8;

export function createSong(partial: Partial<Song> = {}): Song {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Ny låt',
    bpm: 90,
    beatsPerBar: 4,
    subdivision: 1,
    tuningSystem: 'tempered',
    tonicPitchClass: 0,
    tones: [],
    toneGapBpm: DEFAULT_TONE_GAP_BPM,
    notes: '',
    updatedAt: Date.now(),
    ...partial,
  };
}

/**
 * Läser in en låt från lagring och fyller i fält som saknas, så att bibliotek
 * sparade av en äldre version av appen fortsätter fungera.
 */
export function normalizeSong(raw: unknown): Song | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || typeof value.title !== 'string') {
    return null;
  }

  // Ordningen bevaras med flit: den kan vara vald av körledaren och betyder
  // i vilken följd stämmorna får sina toner.
  const tones = Array.isArray(value.tones)
    ? value.tones
        .filter((tone): tone is number => typeof tone === 'number' && Number.isFinite(tone))
        .map((tone) => Math.round(tone))
        .filter((tone) => tone >= 0 && tone <= 127)
        .slice(0, MAX_TONES)
    : [];

  const number = (input: unknown, fallback: number) =>
    typeof input === 'number' && Number.isFinite(input) ? input : fallback;

  return {
    id: value.id,
    title: value.title,
    bpm: Math.min(300, Math.max(30, Math.round(number(value.bpm, 90)))),
    beatsPerBar: Math.max(1, Math.round(number(value.beatsPerBar, 4))),
    subdivision: Math.max(1, Math.round(number(value.subdivision, 1))),
    tuningSystem: value.tuningSystem === 'just' ? 'just' : 'tempered',
    tonicPitchClass: ((Math.round(number(value.tonicPitchClass, 0)) % 12) + 12) % 12,
    tones,
    toneGapBpm: Math.min(
      MAX_TONE_GAP_BPM,
      Math.max(
        MIN_TONE_GAP_BPM,
        Math.round(number(value.toneGapBpm, DEFAULT_TONE_GAP_BPM)),
      ),
    ),
    notes: typeof value.notes === 'string' ? value.notes : '',
    updatedAt: number(value.updatedAt, Date.now()),
  };
}

export function parseLibrary(json: string | null): Song[] {
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeSong)
      .filter((song): song is Song => song !== null);
  } catch {
    // Trasig lagring ska inte hindra appen från att starta.
    return [];
  }
}

export function sortSongs(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => a.title.localeCompare(b.title, 'sv'));
}

/**
 * Riktning genom tonföljden. Med tonerna ordnade efter tonhöjd betyder framåt
 * nedifrån och upp; med egen ordning betyder det den ordning som valdes.
 */
export type PlayDirection = 'chord' | 'forward' | 'backward';

/**
 * Ställer tonerna i den följd de ska spelas.
 *
 * Med tonerna ordnade efter tonhöjd ger 'forward' nedifrån och upp. Med egen
 * ordning respekteras den följd körledaren valde, och 'backward' vänder den.
 */
export function orderTones(
  tones: number[],
  order: ToneOrder,
  direction: PlayDirection,
): number[] {
  const base = order === 'pitch' ? [...tones].sort((a, b) => a - b) : [...tones];
  return direction === 'backward' ? base.reverse() : base;
}

export function toggleTone(
  tones: number[],
  midi: number,
  order: ToneOrder = 'pitch',
): number[] {
  if (tones.includes(midi)) {
    return tones.filter((tone) => tone !== midi);
  }
  if (tones.length >= MAX_TONES) {
    return tones;
  }
  const next = [...tones, midi];
  return order === 'pitch' ? next.sort((a, b) => a - b) : next;
}
