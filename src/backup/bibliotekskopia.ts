/**
 * Säkerhetskopian av låtbiblioteket: vad filen innehåller, och hur en
 * inläst fil vävs ihop med det som redan finns.
 *
 * Två beslut bär hela modulen.
 *
 * Inläsningen går genom samma tolkar som lagringen — parseLibrary och
 * parseFolders, de som är fuzz-testade med tiotusentals slumpade poster. En
 * trasig eller illvillig fil kan därför på sin höjd bli ett tomt bibliotek,
 * aldrig skada det man har.
 *
 * Och sammanfogningen raderar aldrig. En låt som bara finns på telefonen
 * står kvar; en låt som finns i båda behåller den senast ändrade versionen.
 * En import som ersatte biblioteket vore en raderingsknapp i förklädnad —
 * det värsta tänkbara i just den funktion som finns för att inget ska
 * försvinna.
 *
 * Inställningarna följer inte med. De är personliga per enhet — volym,
 * färgtema, klangfärg — medan repertoaren är det som inte går att återskapa.
 */
import {
  type Folder,
  type Song,
  parseFolders,
  parseLibrary,
  sortFolders,
  sortSongs,
  withValidFolders,
} from '../store/songs.ts';

/** Märket som skiljer en riktig kopia från en godtycklig JSON-fil. */
export const FILFORMAT = 'kormetronom-bibliotek';

/** Räknas upp om filens form någon gång ändras oförenligt. */
export const FILVERSION = 1;

export interface Bibliotekskopia {
  format: typeof FILFORMAT;
  version: number;
  /** När kopian togs, som ISO-datum. För människan som ser filen, inte koden. */
  exporterad: string;
  songs: Song[];
  folders: Folder[];
}

/** Filens innehåll, färdigt att skrivas. */
export function skapaKopia(songs: Song[], folders: Folder[], nu: Date): string {
  const kopia: Bibliotekskopia = {
    format: FILFORMAT,
    version: FILVERSION,
    exporterad: nu.toISOString(),
    songs,
    folders,
  };
  // Radbrytningar och indrag med flit: filen är användarens, och en kopia
  // man kan öppna och läsa är en kopia man vågar lita på.
  return JSON.stringify(kopia, null, 2);
}

/** Filnamnet: appens namn och dagens datum, så att kopior går att skilja åt. */
export function kopieNamn(nu: Date): string {
  const datum = nu.toISOString().slice(0, 10);
  return `kormetronom-bibliotek-${datum}.json`;
}

export interface Sammanfogning {
  songs: Song[];
  folders: Folder[];
  /** Hur många låtar som kom till respektive byttes mot en nyare version. */
  tillagda: number;
  uppdaterade: number;
}

/**
 * Läser en kopia och väver ihop den med det befintliga biblioteket.
 *
 * Null betyder att filen inte är en bibliotekskopia alls — fel format eller
 * ogiltig JSON. Det skiljer sig från en giltig men tom kopia, som går bra.
 */
export function läsInKopia(
  json: string,
  befintligaSongs: Song[],
  befintligaFolders: Folder[],
): Sammanfogning | null {
  let rå: unknown;
  try {
    rå = JSON.parse(json);
  } catch {
    return null;
  }
  if (
    typeof rå !== 'object' ||
    rå === null ||
    (rå as { format?: unknown }).format !== FILFORMAT
  ) {
    return null;
  }
  const kopia = rå as { songs?: unknown; folders?: unknown };

  // Samma väg som lagringen: varje post normaliseras eller faller bort.
  const lästaSongs = parseLibrary(JSON.stringify(kopia.songs ?? []));
  const lästaFolders = parseFolders(JSON.stringify(kopia.folders ?? []));

  // Mappar: befintliga behåller sitt namn — ett id är samma mapp, och det
  // man döpt om lokalt ska inte döpas tillbaka av en gammal kopia.
  const mappar = new Map(befintligaFolders.map((mapp) => [mapp.id, mapp]));
  for (const mapp of lästaFolders) {
    if (!mappar.has(mapp.id)) {
      mappar.set(mapp.id, mapp);
    }
  }

  // Låtar: nyast ändrad vinner, och ingenting försvinner.
  const låtar = new Map(befintligaSongs.map((song) => [song.id, song]));
  let tillagda = 0;
  let uppdaterade = 0;
  for (const song of lästaSongs) {
    const befintlig = låtar.get(song.id);
    if (!befintlig) {
      låtar.set(song.id, song);
      tillagda += 1;
    } else if (song.updatedAt > befintlig.updatedAt) {
      låtar.set(song.id, song);
      uppdaterade += 1;
    }
  }

  const folders = sortFolders([...mappar.values()]);
  return {
    songs: sortSongs(withValidFolders([...låtar.values()], folders)),
    folders,
    tillagda,
    uppdaterade,
  };
}
