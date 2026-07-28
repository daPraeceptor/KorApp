import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  centsBetween,
  centsFromTempered,
  frequencyOf,
  isBlackKey,
  justFrequency,
  noteName,
  noteNameWithOctave,
  octaveOf,
  pitchClass,
  temperedFrequency,
} from './tuning.ts';

const close = (actual: number, expected: number, tolerance: number, message: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: fick ${actual}, väntade ${expected} (±${tolerance})`,
  );
};

test('kammartonen A4 ligger på referensfrekvensen', () => {
  close(temperedFrequency(69), 440, 1e-9, 'A4 vid 440');
  close(temperedFrequency(69, 442), 442, 1e-9, 'A4 vid 442');
});

test('tempererade oktaver dubblar frekvensen', () => {
  close(temperedFrequency(57), 220, 1e-9, 'A3');
  close(temperedFrequency(81), 880, 1e-9, 'A5');
});

test('C4 och mellanliggande toner stämmer mot kända värden', () => {
  close(temperedFrequency(60), 261.6255653, 1e-6, 'C4');
  close(temperedFrequency(64), 329.6275569, 1e-6, 'E4');
  close(temperedFrequency(67), 391.9954359, 1e-6, 'G4');
});

test('tonklass och oktav räknas rätt, även under MIDI 0', () => {
  assert.equal(pitchClass(60), 0);
  assert.equal(pitchClass(61), 1);
  assert.equal(pitchClass(-1), 11);
  assert.equal(octaveOf(60), 4);
  assert.equal(octaveOf(59), 3);
});

test('svensk notation använder H och B där internationell använder B och A♯', () => {
  assert.equal(noteName(71, 'swedish'), 'H');
  assert.equal(noteName(70, 'swedish'), 'B');
  assert.equal(noteName(71, 'international'), 'B');
  assert.equal(noteName(70, 'international'), 'A♯');
  assert.equal(noteNameWithOctave(60, 'swedish'), 'C4');
});

test('svarta tangenter är just de fem halvtonsstegen', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((s) => isBlackKey(60 + s)),
    [false, true, false, true, false, false, true, false, true, false, true, false],
  );
});

test('tonikan har samma frekvens i båda stämningarna', () => {
  // Ankaret gör att körledaren kan ge tonikan från en fast referens.
  for (const pc of [0, 2, 5, 7, 9, 11]) {
    close(
      justFrequency(60 + pc, pc),
      temperedFrequency(60 + pc),
      1e-9,
      `tonika med tonklass ${pc}`,
    );
  }
});

test('ren kvint är exakt 3/2 över tonikan', () => {
  const tonic = justFrequency(60, 0); // C4 som tonika
  close(justFrequency(67, 0) / tonic, 3 / 2, 1e-12, 'C4 till G4');
});

test('ren stor ters är exakt 5/4 och ligger 13,7 cent under tempererad', () => {
  const tonic = justFrequency(60, 0);
  close(justFrequency(64, 0) / tonic, 5 / 4, 1e-12, 'C4 till E4');
  close(centsFromTempered(64, { system: 'just', tonicPitchClass: 0, a4: 440 }), -13.686, 0.01, 'stor ters');
});

test('ren kvint ligger 2 cent över tempererad, liten ters 15,6 cent över', () => {
  const tuning = { system: 'just' as const, tonicPitchClass: 0, a4: 440 };
  close(centsFromTempered(67, tuning), 1.955, 0.01, 'kvint');
  close(centsFromTempered(63, tuning), 15.641, 0.01, 'liten ters');
});

test('ren stämning ger exakta oktaver även flera oktaver bort', () => {
  const tuning = { system: 'just' as const, tonicPitchClass: 2, a4: 440 };
  const low = frequencyOf(52, tuning);
  close(frequencyOf(64, tuning) / low, 2, 1e-12, 'en oktav upp');
  close(frequencyOf(76, tuning) / low, 4, 1e-12, 'två oktaver upp');
  close(frequencyOf(40, tuning) / low, 0.5, 1e-12, 'en oktav ner');
});

test('toner under tonikan får rätt kvot', () => {
  // En halvton under tonikan ska vara 15/16 av tonikan, inte 16/15.
  const tonic = justFrequency(60, 0);
  close(justFrequency(59, 0) / tonic, 15 / 16, 1e-12, 'H3 under C4');
  close(justFrequency(55, 0) / tonic, 3 / 4, 1e-12, 'G3, kvart under tonikan');
  close(justFrequency(53, 0) / tonic, 2 / 3, 1e-12, 'F3, kvint under tonikan');
});

test('durtreklangen är svävningsfri i ren stämning', () => {
  // Frekvenskvoterna 4:5:6 är det som gör att svävningarna försvinner.
  const tuning = { system: 'just' as const, tonicPitchClass: 5, a4: 440 };
  const [grundton, ters, kvint] = [65, 69, 72].map((m) => frequencyOf(m, tuning));
  close(ters / grundton, 5 / 4, 1e-12, 'ters mot grundton');
  close(kvint / grundton, 3 / 2, 1e-12, 'kvint mot grundton');
  close(kvint / ters, 6 / 5, 1e-12, 'kvint mot ters');
});

test('tempererad stämning avviker aldrig från sig själv', () => {
  const tuning = { system: 'tempered' as const, tonicPitchClass: 7, a4: 440 };
  for (let midi = 36; midi <= 96; midi += 1) {
    close(centsFromTempered(midi, tuning), 0, 1e-9, `MIDI ${midi}`);
  }
});

test('cent räknas rätt mellan frekvenser', () => {
  close(centsBetween(440, 880), 1200, 1e-9, 'oktav');
  close(centsBetween(440, 440), 0, 1e-9, 'samma ton');
  close(centsBetween(880, 440), -1200, 1e-9, 'oktav nedåt');
});

test('byte av tonika flyttar vilka toner som är rena', () => {
  // Med D som tonika blir F♯ den rena tersen i stället för E.
  const dTonic = { system: 'just' as const, tonicPitchClass: 2, a4: 440 };
  close(centsFromTempered(66, dTonic), -13.686, 0.01, 'F♯ som ters över D');
  close(centsFromTempered(62, dTonic), 0, 1e-9, 'D som tonika');
});
