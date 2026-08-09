/**
 * Ljuddiagnostik.
 *
 * På telefonen syns inga konsolloggar, och ljudfel är tysta till sin natur:
 * det enda symptomet är att ingenting hörs. Varje steg i ljudkedjan skriver
 * därför hit, och inställningarna visar listan. Då kan telefonen själv
 * berätta var kedjan brister, i stället för att felsökningen ska gissa.
 */

export interface AudioLogEntry {
  at: number;
  text: string;
}

const entries: AudioLogEntry[] = [];

/** Fler ryms inte i rutan, och de äldsta är minst intressanta. */
const MAX_ENTRIES = 24;

export function logAudio(text: string): void {
  entries.push({ at: Date.now(), text });
  if (entries.length > MAX_ENTRIES) {
    entries.shift();
  }
}

export function audioLog(): AudioLogEntry[] {
  return [...entries];
}

/** Gör om ett okänt felvärde till något läsbart i loggen. */
export function beskrivFel(fel: unknown): string {
  if (fel instanceof Error) {
    return fel.message;
  }
  try {
    return JSON.stringify(fel);
  } catch {
    return String(fel);
  }
}
