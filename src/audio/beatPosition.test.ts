import { test } from 'node:test';
import assert from 'node:assert/strict';

import { beatPosition, type HeardBeat } from './beatPosition.ts';

const slag = (at: number, count: number): HeardBeat => ({ at, count });

/** 120 slag/min ger ett taktslag var 500:e millisekund. */
const BPM = 120;

test('bilden står stilla i utgångsläget innan första klicket kommit', () => {
  // Blinken vid start kom av att bilden ritades någon annanstans än där
  // första taktslaget börjar, och sedan hoppade dit när klicket kom.
  const väntar = beatPosition(true, null, BPM, false, 1_234_567);
  const förstaKlicket = beatPosition(true, slag(1_234_567, 0), BPM, false, 1_234_567);
  assert.deepEqual(väntar, förstaKlicket, 'utgångsläget måste möta klicket');
  assert.deepEqual(väntar, { phase: 0, direction: 1 });
});

test('stillastående metronom står också i utgångsläget', () => {
  assert.deepEqual(beatPosition(false, null, BPM, false, 999), {
    phase: 0,
    direction: 1,
  });
});

test('med klick räknas läget från när slaget hördes', () => {
  const nu = 10_000;
  assert.equal(beatPosition(true, slag(nu, 0), BPM, false, nu).phase, 0);
  assert.equal(beatPosition(true, slag(nu - 250, 0), BPM, false, nu).phase, 0.5);
  // Ett klick som dröjt kvar längre än ett helt slag kläms till ett, så att
  // pendeln stannar i ytterläget i stället för att svepa förbi.
  assert.equal(beatPosition(true, slag(nu - 900, 0), BPM, false, nu).phase, 1);
});

test('varannat taktslag svänger åt andra hållet', () => {
  const nu = 10_000;
  assert.equal(beatPosition(true, slag(nu, 0), BPM, false, nu).direction, 1);
  assert.equal(beatPosition(true, slag(nu, 1), BPM, false, nu).direction, -1);
  assert.equal(beatPosition(true, slag(nu, 2), BPM, false, nu).direction, 1);
  // Räknaren löper vidare över taktgränser, så udda tal är alltid åt vänster.
  assert.equal(beatPosition(true, slag(nu, 17), BPM, false, nu).direction, -1);
});

test('tyst läge går på egen klocka i rätt takt', () => {
  // Utan ljud finns inga klick att följa, men takten ska ändå synas.
  assert.equal(beatPosition(true, null, BPM, true, 4000).phase, 0);
  assert.equal(beatPosition(true, null, BPM, true, 4250).phase, 0.5);
  assert.equal(beatPosition(true, null, BPM, true, 4500).direction, -1);
  assert.equal(beatPosition(true, null, BPM, true, 5000).direction, 1);
});

test('ljudet vinner över den egna klockan', () => {
  // Så fort ett klick finns följer bilden det, även om tyst är satt.
  const nu = 4250;
  assert.deepEqual(beatPosition(true, slag(nu, 0), BPM, true, nu), {
    phase: 0,
    direction: 1,
  });
});

test('tempot styr hur fort fasen löper', () => {
  // 60 slag/min: ett helt taktslag tar en sekund.
  assert.equal(beatPosition(true, slag(1000, 0), 60, false, 1500).phase, 0.5);
  // 240 slag/min: samma halva slag på en fjärdedels sekund.
  assert.equal(beatPosition(true, slag(1000, 0), 240, false, 1125).phase, 0.5);
});
