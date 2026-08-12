/**
 * Ackordanalysen och den enharmoniska stavningen.
 *
 * Reglerna är lätta att tro sig ha rätt om och ha fel om, så de vanligaste
 * ackorden en kör möter mäts här — särskilt de svarta tangenterna, där valet
 * mellan kors och b avgör om notbilden blir läsbar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyseraAckord,
  enklasteStavning,
  standardStavning,
  tonNamn,
  ärSvartTangent,
} from './chords.ts';

test('förvalet för svarta tangenter är C♯, E♭, F♯, A♭, B♭', () => {
  const namn = [1, 3, 6, 8, 10].map((pc) =>
    tonNamn(pc, standardStavning(pc)),
  );
  assert.deepEqual(namn, ['C♯', 'E♭', 'F♯', 'A♭', 'B♭']);
});

test('vita tangenter räknas inte som svarta', () => {
  assert.equal(ärSvartTangent(0), false);
  assert.equal(ärSvartTangent(4), false);
  assert.equal(ärSvartTangent(6), true);
});

test('durtreklang får sitt namn', () => {
  // D, F♯, A
  assert.equal(analyseraAckord([50, 54, 57]).namn, 'D');
});

test('molltreklang får sitt m', () => {
  // A, C, E
  assert.equal(analyseraAckord([57, 60, 64]).namn, 'Am');
});

test('E♭-dur skrivs med b, inte som D♯', () => {
  // E♭, G, B♭
  const ackord = analyseraAckord([51, 55, 58]);
  assert.equal(ackord.namn, 'E♭');
  assert.equal(ackord.stavning.get(3), 'flat');
  assert.equal(ackord.stavning.get(10), 'flat');
});

test('C♯-moll skrivs med kors, inte som D♭-moll', () => {
  // C♯, E, G♯
  const ackord = analyseraAckord([49, 52, 56]);
  assert.equal(ackord.namn, 'C♯m');
  assert.equal(ackord.stavning.get(1), 'sharp');
  assert.equal(ackord.stavning.get(8), 'sharp');
});

test('septimackord känns igen', () => {
  // G, B, D, F
  assert.equal(analyseraAckord([55, 59, 62, 65]).namn, 'G7');
});

test('vald grundton avgör när tonerna kan tydas på flera sätt', () => {
  // A, C, E kan läsas som Am eller som C6 utan kvint. Väljer man C som
  // grundton ska analysen utgå därifrån.
  const utanVal = analyseraAckord([57, 60, 64]);
  assert.equal(utanVal.grund, 9, 'utan vald grundton vinner A');
  const medC = analyseraAckord([57, 60, 64], 0);
  assert.equal(medC.grund, 9, 'C bildar inget känt ackord med de tonerna');
});

test('grundtonen vinner när den ger ett giltigt ackord', () => {
  // C, E, G kan tydas som C-dur. Med E vald som grundton finns ingen
  // känd harmoni med E underst, så C står kvar.
  const ackord = analyseraAckord([60, 64, 67], 4);
  assert.equal(ackord.namn, 'C');
});

test('två toner en kvint isär ger ett kvintackord', () => {
  // D och A
  assert.equal(analyseraAckord([50, 57]).namn, 'D5');
});

test('otydbara toner ger inget namn men ändå stavning', () => {
  // C, C♯, D — ingen känd harmoni.
  const ackord = analyseraAckord([60, 61, 62]);
  assert.equal(ackord.namn, null);
  assert.equal(tonNamn(1, ackord.stavning.get(1)!), 'C♯');
});

test('en ensam ton stavas men bildar inget ackord', () => {
  const ackord = analyseraAckord([54]);
  assert.equal(ackord.namn, null);
  assert.equal(tonNamn(6, ackord.stavning.get(6)!), 'F♯');
});

test('svensk notation kallar tonklass 11 för H', () => {
  assert.equal(tonNamn(11, 'sharp', 'swedish'), 'H');
  assert.equal(tonNamn(10, 'flat', 'swedish'), 'B');
  assert.equal(tonNamn(11, 'sharp', 'international'), 'B');
});
