import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_BPM, MIN_BPM, clampBpm, tempoFromTaps } from './tempo.ts';

test('tempo hålls inom rimliga gränser och avrundas', () => {
  assert.equal(clampBpm(120.4), 120);
  assert.equal(clampBpm(1), MIN_BPM);
  assert.equal(clampBpm(9999), MAX_BPM);
});

test('knacktempo behöver minst två knackningar', () => {
  assert.equal(tempoFromTaps([]), null);
  assert.equal(tempoFromTaps([1000]), null);
});

test('jämna knackningar ger exakt tempo', () => {
  // 500 ms mellan knackningarna = 120 slag per minut.
  assert.equal(tempoFromTaps([0, 500, 1000, 1500]), 120);
  assert.equal(tempoFromTaps([0, 1000, 2000]), 60);
});

test('en missad knackning förstör inte tempot', () => {
  // Fyra jämna intervall på 500 ms och ett dubbelt så långt hopp.
  const taps = [0, 500, 1000, 1500, 2500, 3000, 3500];
  assert.equal(tempoFromTaps(taps), 120);
});

test('lätt ojämna knackningar ger tempot däremellan', () => {
  const bpm = tempoFromTaps([0, 490, 1010, 1500]);
  assert.ok(bpm !== null && Math.abs(bpm - 120) <= 2, `fick ${bpm}`);
});
