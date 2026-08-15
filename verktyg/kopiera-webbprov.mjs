/**
 * Kopierar körregistrets pianoprov till public/, som webbygget serverar.
 *
 * Originalen — hela klaviaturen — ligger i assets/piano och buntas in i
 * mobilappen. Webben får bara det register en kör faktiskt sjunger i, se
 * src/audio/pianoprov.ts. Katalogen som skapas här är inte incheckad: den är
 * härledd, och skulle bara ligga och dubblera fem megabyte i historiken.
 *
 *   node verktyg/kopiera-webbprov.mjs
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rot = join(dirname(fileURLToPath(import.meta.url)), '..');
const från = join(rot, 'assets', 'piano');
const till = join(rot, 'public', 'piano');

/** Samma gränser som webbens provlista. Hålls i takt av provet nedan. */
const LÄGSTA = 36;
const HÖGSTA = 84;

rmSync(till, { recursive: true, force: true });
mkdirSync(till, { recursive: true });

let antal = 0;
let byte = 0;
for (const fil of readdirSync(från)) {
  const midi = Number(fil.replace('.ogg', ''));
  if (!Number.isFinite(midi) || midi < LÄGSTA || midi > HÖGSTA) {
    continue;
  }
  copyFileSync(join(från, fil), join(till, fil));
  byte += statSync(join(från, fil)).size;
  antal += 1;
}

console.log(
  `Kopierade ${antal} pianoprov (${(byte / 1048576).toFixed(2)} MB) till public/piano`,
);
