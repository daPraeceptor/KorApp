/**
 * Vad händer när biblioteket blir stort? En kör med tio års repertoar samlar
 * lätt några hundra låtar i ett dussin mappar.
 */
import { test } from 'node:test';

import {
  type Song,
  createSong,
  moveSongInFolder,
  parseLibrary,
  placeSongInFolder,
  searchSongs,
  sortSongs,
} from '../src/store/songs.ts';

function bibliotek(antal: number, mappar: number): Song[] {
  return Array.from({ length: antal }, (_, i) =>
    createSong({
      id: `s${i}`,
      title: `Låt nummer ${i} med ett någorlunda långt namn`,
      folderId: i % 5 === 0 ? null : `f${i % mappar}`,
      sortIndex: (i % 40) + 1,
      tones: [60, 64, 67, 72],
      notes: 'Anteckning om insatser och andning. '.repeat(3),
    }),
  );
}

function mät(namn: string, gånger: number, arbete: () => unknown) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < gånger; i += 1) {
    arbete();
  }
  const ms = Number(process.hrtime.bigint() - start) / 1e6 / gånger;
  console.log(`    ${namn.padEnd(34)} ${ms.toFixed(3)} ms`);
  return ms;
}

test('stora bibliotek', () => {
  for (const antal of [100, 500, 2000]) {
    const låtar = bibliotek(antal, 12);
    const json = JSON.stringify(låtar);
    console.log(`  [${antal} låtar] lagringen blir ${(json.length / 1024).toFixed(0)} kB`);
    mät('sortSongs', 200, () => sortSongs(låtar));
    mät('searchSongs (träff på en)', 200, () => searchSongs(låtar, 'nummer 7 '));
    mät('JSON.stringify (varje sparning)', 200, () => JSON.stringify(låtar));
    mät('parseLibrary (varje start)', 50, () => parseLibrary(json));
    mät('moveSongInFolder + sortSongs', 200, () =>
      sortSongs(moveSongInFolder(låtar, `s${Math.floor(antal / 2)}`, 1)),
    );
    mät('placeSongInFolder + sortSongs', 200, () =>
      sortSongs(placeSongInFolder(låtar, `s${Math.floor(antal / 2)}`, 'f3', 5)),
    );
  }
});

test('en dragning genom en mapp skriver om hela biblioteket', () => {
  // Dragningen ropar på moveSongInFolder varje gång fingret passerat en granne.
  const antal = 500;
  let låtar = bibliotek(antal, 4);
  const grannarPassade = 30;
  const start = process.hrtime.bigint();
  let skrivnaTecken = 0;
  for (let i = 0; i < grannarPassade; i += 1) {
    låtar = sortSongs(moveSongInFolder(låtar, 's1', 1));
    // Effekten i AppState serialiserar hela biblioteket vid varje ändring.
    skrivnaTecken += JSON.stringify(låtar).length;
  }
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(
    `  [dragning] ${grannarPassade} passerade grannar i ett bibliotek på ${antal} låtar: ` +
      `${ms.toFixed(0)} ms räknande och ${(skrivnaTecken / 1024 / 1024).toFixed(1)} MB skrivet till lagringen`,
  );
});

test('varje tangenttryck i titeln sparar om allt', () => {
  const låtar = bibliotek(300, 8);
  const titel = 'Härlig är jorden';
  const start = process.hrtime.bigint();
  let tecken = 0;
  for (let i = 1; i <= titel.length; i += 1) {
    const ändrade = låtar.map((s) => (s.id === 's7' ? { ...s, title: titel.slice(0, i) } : s));
    tecken += JSON.stringify(sortSongs(ändrade)).length;
  }
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(
    `  [titelredigering] ${titel.length} tangenttryck → ${titel.length} sparningar, ` +
      `${(tecken / 1024).toFixed(0)} kB serialiserat på ${ms.toFixed(0)} ms`,
  );
});
