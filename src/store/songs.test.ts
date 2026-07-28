import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TONE_GAP_BPM,
  MAX_TONES,
  normalizeSong,
  orderTones,
  parseLibrary,
  toggleTone,
} from './songs.ts';

// G4, C4, E4 — medvetet inte i tonhöjdsordning.
const VALD_ORDNING = [67, 60, 64];

test('toner läggs efter tonhöjd när ordningen är pitch', () => {
  let tones: number[] = [];
  for (const midi of [67, 60, 64]) {
    tones = toggleTone(tones, midi, 'pitch');
  }
  assert.deepEqual(tones, [60, 64, 67]);
});

test('toner behåller vald ordning när ordningen är entry', () => {
  let tones: number[] = [];
  for (const midi of [67, 60, 64]) {
    tones = toggleTone(tones, midi, 'entry');
  }
  assert.deepEqual(tones, [67, 60, 64]);
});

test('att ta bort en ton rubbar inte de övrigas ordning', () => {
  const tones = toggleTone([67, 60, 64], 60, 'entry');
  assert.deepEqual(tones, [67, 64]);
});

test('samma ton två gånger tar bort den', () => {
  const tones = toggleTone([60, 64], 64, 'pitch');
  assert.deepEqual(tones, [60]);
});

test('fler toner än taket läggs inte till', () => {
  const full = Array.from({ length: MAX_TONES }, (_, i) => 60 + i);
  assert.deepEqual(toggleTone(full, 90, 'entry'), full);
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

test('låt utan hastighet får standardvärdet', () => {
  const song = normalizeSong({ id: 'x', title: 'Gammal låt' });
  assert.ok(song);
  assert.equal(song.toneGapBpm, DEFAULT_TONE_GAP_BPM);
});

test('orimlig hastighet kläms till giltigt område', () => {
  const snabb = normalizeSong({ id: 'x', title: 'Snabb', toneGapBpm: 9999 });
  const langsam = normalizeSong({ id: 'y', title: 'Långsam', toneGapBpm: 1 });
  assert.equal(snabb?.toneGapBpm, 200);
  assert.equal(langsam?.toneGapBpm, 20);
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

test('efter tonhöjd spelas framåt nedifrån och upp', () => {
  assert.deepEqual(orderTones(VALD_ORDNING, 'pitch', 'forward'), [60, 64, 67]);
});

test('efter tonhöjd spelas bakåt uppifrån och ner', () => {
  assert.deepEqual(orderTones(VALD_ORDNING, 'pitch', 'backward'), [67, 64, 60]);
});

test('vald ordning respekteras framåt', () => {
  assert.deepEqual(orderTones(VALD_ORDNING, 'entry', 'forward'), [67, 60, 64]);
});

test('vald ordning vänds bakåt', () => {
  assert.deepEqual(orderTones(VALD_ORDNING, 'entry', 'backward'), [64, 60, 67]);
});

test('bakåt är alltid framåt baklänges', () => {
  for (const order of ['pitch', 'entry'] as const) {
    const framat = orderTones(VALD_ORDNING, order, 'forward');
    const bakat = orderTones(VALD_ORDNING, order, 'backward');
    assert.deepEqual(bakat, [...framat].reverse(), `ordning ${order}`);
  }
});

test('ordningen lämnar ursprungslistan orörd', () => {
  const original = [...VALD_ORDNING];
  orderTones(VALD_ORDNING, 'pitch', 'backward');
  orderTones(VALD_ORDNING, 'entry', 'backward');
  assert.deepEqual(VALD_ORDNING, original);
});

test('en enda ton fungerar i alla lägen', () => {
  for (const order of ['pitch', 'entry'] as const) {
    for (const direction of ['forward', 'backward', 'chord'] as const) {
      assert.deepEqual(orderTones([64], order, direction), [64]);
    }
  }
});

test('trasig lagring ger ett tomt bibliotek i stället för krasch', () => {
  assert.deepEqual(parseLibrary('{ trasig json'), []);
  assert.deepEqual(parseLibrary(null), []);
  assert.deepEqual(parseLibrary('{"inte":"en lista"}'), []);
});
