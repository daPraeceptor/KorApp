import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_TONES,
  createFolder,
  normalizeSong,
  orderTones,
  parseFolders,
  parseLibrary,
  searchSongs,
  toggleTone,
  withValidFolders,
} from './songs.ts';

const lat = (id: string, title: string, folderId: string | null = null) =>
  ({ id, title, folderId }) as never;

// G4, C4, E4 — medvetet inte i tonhöjdsordning.
const VALD_ORDNING = [67, 60, 64];

test('toner behåller alltid den ordning de valdes i', () => {
  let tones: number[] = [];
  for (const midi of [67, 60, 64]) {
    tones = toggleTone(tones, midi);
  }
  assert.deepEqual(tones, [67, 60, 64]);
});

test('att ta bort en ton rubbar inte de övrigas ordning', () => {
  assert.deepEqual(toggleTone([67, 60, 64], 60), [67, 64]);
});

test('samma ton två gånger tar bort den', () => {
  assert.deepEqual(toggleTone([60, 64], 64), [60]);
});

test('fler toner än taket läggs inte till', () => {
  const full = Array.from({ length: MAX_TONES }, (_, i) => 60 + i);
  assert.deepEqual(toggleTone(full, 90), full);
});

test('sparad tonordning överlever inläsning från lagring', () => {
  // Ordningen är betydelsebärande och får inte sorteras om vid start.
  const song = normalizeSong({
    id: 'x',
    title: 'Insatsordning',
    tones: [72, 60, 67, 64],
  });
  assert.ok(song);
  assert.deepEqual(song.tones, [72, 60, 67, 64]);
});

test('ogiltiga toner rensas bort utan att rubba ordningen', () => {
  const song = normalizeSong({
    id: 'x',
    title: 'Skräp',
    tones: [72, 999, 60, -5, 'g', null, 67],
  });
  assert.ok(song);
  assert.deepEqual(song.tones, [72, 60, 67]);
});

test('hastigheten mellan tonerna följer inte längre med låten', () => {
  // Låtar sparade förr bär fältet vidare i lagringen. Det ska inte läsas in
  // igen, eftersom hastigheten numera är en inställning som gäller alla låtar.
  const song = normalizeSong({ id: 'x', title: 'Gammal låt', toneGapBpm: 150 });
  assert.ok(song);
  assert.ok(!('toneGapBpm' in song));
});

test('trasiga poster sorteras bort utan att fälla inläsningen', () => {
  const library = parseLibrary(
    JSON.stringify([
      { id: 'a', title: 'Giltig' },
      { id: 'b' },
      { title: 'Utan id' },
      null,
      'inte ens ett objekt',
    ]),
  );
  assert.equal(library.length, 1);
  assert.equal(library[0].title, 'Giltig');
});

test('uppåt sorterar efter stigande tonhöjd', () => {
  assert.deepEqual(orderTones(VALD_ORDNING, 'up'), [60, 64, 67]);
});

test('nedåt sorterar efter fallande tonhöjd', () => {
  assert.deepEqual(orderTones(VALD_ORDNING, 'down'), [67, 64, 60]);
});

test('vald ordning spelas precis som den sparades', () => {
  assert.deepEqual(orderTones(VALD_ORDNING, 'chosen'), [67, 60, 64]);
});

test('nedåt är alltid uppåt baklänges', () => {
  const upp = orderTones(VALD_ORDNING, 'up');
  const ner = orderTones(VALD_ORDNING, 'down');
  assert.deepEqual(ner, [...upp].reverse());
});

test('ordningen lämnar ursprungslistan orörd', () => {
  const original = [...VALD_ORDNING];
  for (const direction of ['up', 'down', 'chosen', 'chord'] as const) {
    orderTones(VALD_ORDNING, direction);
  }
  assert.deepEqual(VALD_ORDNING, original);
});

test('en enda ton fungerar i alla riktningar', () => {
  for (const direction of ['up', 'down', 'chosen', 'chord'] as const) {
    assert.deepEqual(orderTones([64], direction), [64]);
  }
});

test('alla riktningar innehåller samma toner', () => {
  const sorterat = (list: number[]) => [...list].sort((a, b) => a - b);
  for (const direction of ['up', 'down', 'chosen', 'chord'] as const) {
    assert.deepEqual(
      sorterat(orderTones(VALD_ORDNING, direction)),
      sorterat(VALD_ORDNING),
      `riktning ${direction}`,
    );
  }
});

test('en låt utan mapp läses in som lös', () => {
  const song = normalizeSong({ id: 'x', title: 'Gammal låt' });
  assert.equal(song?.folderId, null);
});

test('en låts mapp överlever inläsning', () => {
  const song = normalizeSong({ id: 'x', title: 'I mapp', folderId: 'f-1' });
  assert.equal(song?.folderId, 'f-1');
});

test('mappar med skräp i lagringen sorteras bort', () => {
  const mappar = parseFolders(
    JSON.stringify([
      { id: 'f-1', name: 'Vårkonsert', createdAt: 1 },
      { id: 'f-2' },
      { name: 'Utan id' },
      null,
    ]),
  );
  assert.equal(mappar.length, 1);
  assert.equal(mappar[0].name, 'Vårkonsert');
});

test('trasig mapplagring ger tom lista i stället för krasch', () => {
  assert.deepEqual(parseFolders('{ trasig'), []);
  assert.deepEqual(parseFolders(null), []);
});

test('en ny mapp får ett namn även om fältet lämnas tomt', () => {
  assert.equal(createFolder('   ').name, 'Ny mapp');
  assert.equal(createFolder('  Advent  ').name, 'Advent');
});

test('låtar i en mapp som försvunnit blir lösa i stället för osynliga', () => {
  const songs = [lat('a', 'Kvar', 'f-1'), lat('b', 'Hemlös', 'f-borta'), lat('c', 'Lös')];
  const resultat = withValidFolders(songs, [
    { id: 'f-1', name: 'Finns', createdAt: 1 },
  ]);
  assert.deepEqual(
    resultat.map((s) => s.folderId),
    ['f-1', null, null],
  );
});

test('sökning matchar oberoende av versaler och träffar mitt i titeln', () => {
  const songs = [lat('a', 'Vårvindar friska'), lat('b', 'Sommarpsalm'), lat('c', 'Vintern rasat')];
  assert.deepEqual(searchSongs(songs, 'vår').map((s) => s.id), ['a']);
  assert.deepEqual(searchSongs(songs, 'PSALM').map((s) => s.id), ['b']);
  assert.deepEqual(searchSongs(songs, 'ras').map((s) => s.id), ['c']);
});

test('tom sökning ger alla låtar', () => {
  const songs = [lat('a', 'En'), lat('b', 'Två')];
  assert.equal(searchSongs(songs, '').length, 2);
  assert.equal(searchSongs(songs, '   ').length, 2);
});

test('sökning utan träff ger tom lista', () => {
  assert.deepEqual(searchSongs([lat('a', 'En')], 'finns inte'), []);
});

test('trasig lagring ger ett tomt bibliotek i stället för krasch', () => {
  assert.deepEqual(parseLibrary('{ trasig json'), []);
  assert.deepEqual(parseLibrary(null), []);
  assert.deepEqual(parseLibrary('{"inte":"en lista"}'), []);
});
