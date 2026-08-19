/**
 * Prov på säkerhetskopian.
 *
 * Kravet som allt annat står på: inläsning får aldrig radera. Funktionen
 * finns för att inget ska försvinna, och en sammanfogning som tappar en låt
 * vore värre än ingen funktion alls — den skulle förstöra i förtroendets
 * namn. Därför prövas den även med trasiga, fientliga och slumpade filer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FILFORMAT,
  kopieNamn,
  läsInKopia,
  skapaKopia,
} from './bibliotekskopia.ts';
import { type Song, createSong, createFolder } from '../store/songs.ts';

const NU = new Date('2026-08-19T10:00:00Z');

const låt = (id: string, titel: string, ändrad: number, extra: Partial<Song> = {}) =>
  createSong({ id, title: titel, updatedAt: ändrad, ...extra });

test('en kopia som läses tillbaka ger samma bibliotek', () => {
  const mappar = [{ ...createFolder('Vårkonsert'), id: 'm1' }];
  const låtar = [
    låt('a', 'Aftonen', 100, { folderId: 'm1', tones: [69, 65], bpm: 62 }),
    låt('b', 'Kom', 200, { tones: [50, 54, 38] }),
  ];
  const fil = skapaKopia(låtar, mappar, NU);
  const resultat = läsInKopia(fil, [], []);

  assert.ok(resultat);
  assert.equal(resultat.tillagda, 2);
  assert.equal(resultat.uppdaterade, 0);
  assert.deepEqual(
    resultat.songs.map((s) => [s.id, s.title, s.bpm, s.tones]).sort(),
    [
      ['a', 'Aftonen', 62, [69, 65]],
      ['b', 'Kom', 90, [50, 54, 38]],
    ],
  );
  assert.equal(resultat.folders[0].name, 'Vårkonsert');
});

test('inläsning raderar aldrig, hur kopian än ser ut', () => {
  const bara_lokal = låt('lokal', 'Bara på telefonen', 500);
  const gemensam = låt('gemensam', 'Nyare lokalt', 900);
  const befintliga = [bara_lokal, gemensam];

  // Kopian saknar den lokala låten och bär en äldre version av den gemensamma.
  const fil = skapaKopia([låt('gemensam', 'Äldre i kopian', 100)], [], NU);
  const resultat = läsInKopia(fil, befintliga, []);

  assert.ok(resultat);
  const ids = resultat.songs.map((s) => s.id).sort();
  assert.deepEqual(ids, ['gemensam', 'lokal'], 'ingen låt får försvinna');
  const kvar = resultat.songs.find((s) => s.id === 'gemensam');
  assert.equal(kvar?.title, 'Nyare lokalt', 'den nyare lokala versionen vinner');
  assert.equal(resultat.tillagda, 0);
  assert.equal(resultat.uppdaterade, 0);
});

test('en nyare version i kopian byter ut den lokala', () => {
  const fil = skapaKopia([låt('a', 'Rättad titel', 900, { bpm: 72 })], [], NU);
  const resultat = läsInKopia(fil, [låt('a', 'Feltitel', 100)], []);
  assert.ok(resultat);
  assert.equal(resultat.songs[0].title, 'Rättad titel');
  assert.equal(resultat.uppdaterade, 1);
});

test('lokala mappnamn står kvar även om kopian bär gamla', () => {
  const lokal = { ...createFolder('Omdöpt lokalt'), id: 'm1' };
  const fil = skapaKopia([], [{ ...createFolder('Gammalt namn'), id: 'm1' }], NU);
  const resultat = läsInKopia(fil, [], [lokal]);
  assert.ok(resultat);
  assert.equal(resultat.folders[0].name, 'Omdöpt lokalt');
});

test('en låt vars mapp inte följde med hamnar löst, inte gömd', () => {
  const fil = skapaKopia([låt('a', 'Utan mapp', 100, { folderId: 'saknas' })], [], NU);
  const resultat = läsInKopia(fil, [], []);
  assert.ok(resultat);
  assert.equal(resultat.songs[0].folderId, null);
});

test('fel filer avvisas utan att röra biblioteket', () => {
  const befintliga = [låt('a', 'Ska stå kvar', 100)];
  for (const skräp of [
    'inte json',
    '{}',
    '[]',
    'null',
    JSON.stringify({ format: 'nagot-annat', songs: [] }),
    JSON.stringify({ songs: [{ id: 'x', title: 'Smygare' }] }),
  ]) {
    assert.equal(läsInKopia(skräp, befintliga, []), null, `släppte igenom: ${skräp.slice(0, 30)}`);
  }
});

test('en fientlig kopia kan som mest bli tomma tillägg', () => {
  // Skräpposter går genom samma normalisering som lagringen: fel typer
  // faller bort eller kläms in i sina gränser.
  const fil = JSON.stringify({
    format: FILFORMAT,
    version: 1,
    songs: [
      null,
      42,
      { id: 'x', title: 'Halvtrasig', bpm: 1e308, tones: [999, -5, 60, 'nej'] },
      { title: 'utan id' },
    ],
    folders: 'inte en lista',
  });
  const resultat = läsInKopia(fil, [låt('a', 'Orörd', 100)], []);
  assert.ok(resultat);
  assert.equal(resultat.songs.length, 2, 'bara den halvtrasiga kom in, normaliserad');
  const inläst = resultat.songs.find((s) => s.id === 'x');
  assert.ok(inläst && inläst.bpm <= 300 && inläst.tones.every((t) => t >= 0 && t <= 127));
});

test('filnamnet bär datumet', () => {
  assert.equal(kopieNamn(NU), 'kormetronom-bibliotek-2026-08-19.json');
});

test('20 000 slumpade sammanfogningar tappar aldrig en låt', () => {
  let frö = 424242;
  const slump = () => {
    frö = (frö * 1103515245 + 12345) % 2147483648;
    return frö / 2147483648;
  };

  for (let varv = 0; varv < 200; varv += 1) {
    const lokala = Array.from({ length: Math.floor(slump() * 20) }, (_, i) =>
      låt(`id${Math.floor(slump() * 30)}-${i % 7}`, `Låt ${i}`, Math.floor(slump() * 1000)),
    );
    const kopians = Array.from({ length: Math.floor(slump() * 20) }, (_, i) =>
      låt(`id${Math.floor(slump() * 30)}-${i % 7}`, `Kopia ${i}`, Math.floor(slump() * 1000)),
    );
    const fil = skapaKopia(kopians, [], NU);
    const resultat = läsInKopia(fil, lokala, []);
    assert.ok(resultat);

    const lokalaIds = new Set(lokala.map((s) => s.id));
    const kvarIds = new Set(resultat.songs.map((s) => s.id));
    for (const id of lokalaIds) {
      assert.ok(kvarIds.has(id), `varv ${varv}: låten ${id} försvann`);
    }
  }
});
