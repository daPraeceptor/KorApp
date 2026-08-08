import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_SONGS } from './defaultSongs.ts';
import { MAX_TONES, normalizeSong } from './songs.ts';

/**
 * De medföljande låtarna skrivs för hand och går aldrig genom createSong.
 * Testerna håller dem inom samma gränser som inläsningen kräver — annars
 * skulle en felskrivning här möta användaren vid allra första starten.
 */

test('varje medföljande låt överlever inläsningen oförändrad', () => {
  for (const song of DEFAULT_SONGS) {
    const inläst = normalizeSong(song);
    assert.ok(inläst, `${song.title} kunde inte läsas in`);
    assert.deepEqual(inläst, song, `${song.title} ändrades av inläsningen`);
  }
});

test('id och titlar är unika', () => {
  const idn = DEFAULT_SONGS.map((song) => song.id);
  const titlar = DEFAULT_SONGS.map((song) => song.title);
  assert.equal(new Set(idn).size, idn.length, 'två låtar delar id');
  assert.equal(new Set(titlar).size, titlar.length, 'två låtar delar titel');
});

test('tempo, taktart och grundton ligger inom giltiga områden', () => {
  for (const song of DEFAULT_SONGS) {
    assert.ok(song.bpm >= 30 && song.bpm <= 300, `${song.title}: orimligt tempo`);
    assert.ok(song.beatsPerBar >= 1, `${song.title}: orimlig taktart`);
    assert.ok(
      song.tonicPitchClass >= 0 && song.tonicPitchClass <= 11,
      `${song.title}: grundtonen utanför oktaven`,
    );
  }
});

test('tonerna är spelbara och inte fler än vad appen tillåter', () => {
  for (const song of DEFAULT_SONGS) {
    assert.ok(song.tones.length <= MAX_TONES, `${song.title}: för många toner`);
    for (const midi of song.tones) {
      assert.ok(
        Number.isInteger(midi) && midi >= 24 && midi <= 96,
        `${song.title}: tonen ${midi} ligger utanför klaviaturen`,
      );
    }
  }
});

test('varje låt har minst en ton att ge kören', () => {
  // Grundtonen behöver däremot inte finnas bland tonerna. Den är referensen som
  // den rena stämningen räknas ifrån, och att ge kören en annan ton än
  // grundtonen är vanligt — ett D i en sats som står i G.
  for (const song of DEFAULT_SONGS) {
    assert.ok(song.tones.length > 0, `${song.title}: saknar toner`);
  }
});
