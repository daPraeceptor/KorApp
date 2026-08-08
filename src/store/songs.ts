/**
 * Låtbiblioteket: tempo, taktart, stämning och starttoner sparade per låt.
 */
import type { TuningSystem } from '../theory/tuning';
// SubdivisionId är en typ och måste märkas som sådan, annars försöker Node
// importera den i körläge när testerna går.
import { type SubdivisionId, toSubdivisionId } from '../audio/subdivisions.ts';

/**
 * Riktning genom en låts toner vid uppspelning.
 *
 * Tonerna sparas alltid i den ordning körledaren valde dem, så att både
 * tonhöjdsordning och den valda följden finns tillgängliga samtidigt.
 */
export type PlayDirection = 'chord' | 'up' | 'down' | 'chosen';

export interface Song {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  subdivision: SubdivisionId;
  tuningSystem: TuningSystem;
  /** Tonklass 0–11 för låtens grundton. */
  tonicPitchClass: number;
  /** MIDI-nummer för de toner kören ska få. Ordningen kan vara betydelsebärande. */
  tones: number[];
  notes: string;
  updatedAt: number;
  /** Mappen låten ligger i. null betyder att den ligger löst i listan. */
  folderId: string | null;
}

/** En mapp att samla låtar i, till exempel en konsert eller en termin. */
export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export function createFolder(name: string): Folder {
  return {
    id: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Ny mapp',
    createdAt: Date.now(),
  };
}

function normalizeFolder(raw: unknown): Folder | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }
  return {
    id: value.id,
    name: value.name,
    createdAt:
      typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
        ? value.createdAt
        : Date.now(),
  };
}

export function parseFolders(json: string | null): Folder[] {
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeFolder)
      .filter((folder): folder is Folder => folder !== null);
  } catch {
    return [];
  }
}

export function sortFolders(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

/**
 * Låtar vars mapp inte längre finns läggs löst i listan i stället för att
 * försvinna. Kan hända om lagringen skrivits av en äldre version, eller om en
 * mapp tagits bort utan att låtarna hann flyttas.
 */
export function withValidFolders(songs: Song[], folders: Folder[]): Song[] {
  const finns = new Set(folders.map((folder) => folder.id));
  return songs.map((song) =>
    song.folderId && !finns.has(song.folderId) ? { ...song, folderId: null } : song,
  );
}

/** Filtrerar låtar på fritext i titeln. Tom sökning ger alla. */
export function searchSongs(songs: Song[], query: string): Song[] {
  const trimmed = query.trim().toLocaleLowerCase('sv');
  if (!trimmed) {
    return songs;
  }
  return songs.filter((song) =>
    song.title.toLocaleLowerCase('sv').includes(trimmed),
  );
}

/**
 * Hastigheten tonerna ges i en i taget. Den hör till körledarens arbetssätt och
 * inte till låten, så den ligger i inställningarna och gäller alla låtar.
 */
export const MIN_TONE_GAP_BPM = 40;
export const MAX_TONE_GAP_BPM = 360;
export const DEFAULT_TONE_GAP_BPM = 80;

export const MAX_TONES = 8;

export function createSong(partial: Partial<Song> = {}): Song {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Ny låt',
    bpm: 90,
    beatsPerBar: 4,
    subdivision: 'quarter',
    tuningSystem: 'tempered',
    tonicPitchClass: 0,
    tones: [],
    notes: '',
    updatedAt: Date.now(),
    folderId: null,
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
    // Underdelningen sparades förr som antal klick per slag.
    subdivision: toSubdivisionId(value.subdivision),
    tuningSystem: value.tuningSystem === 'just' ? 'just' : 'tempered',
    tonicPitchClass: ((Math.round(number(value.tonicPitchClass, 0)) % 12) + 12) % 12,
    tones,
    notes: typeof value.notes === 'string' ? value.notes : '',
    updatedAt: number(value.updatedAt, Date.now()),
    folderId: typeof value.folderId === 'string' ? value.folderId : null,
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

/** Ställer tonerna i den följd de ska spelas. */
export function orderTones(tones: number[], direction: PlayDirection): number[] {
  switch (direction) {
    case 'up':
      return [...tones].sort((a, b) => a - b);
    case 'down':
      return [...tones].sort((a, b) => b - a);
    default:
      // Ackordet spelas ändå samtidigt, så den valda ordningen duger åt båda.
      return [...tones];
  }
}

/** Lägger till eller tar bort en ton. Nya toner hamnar sist, i vald ordning. */
export function toggleTone(tones: number[], midi: number): number[] {
  if (tones.includes(midi)) {
    return tones.filter((tone) => tone !== midi);
  }
  if (tones.length >= MAX_TONES) {
    return tones;
  }
  return [...tones, midi];
}
