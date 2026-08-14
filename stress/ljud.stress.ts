/**
 * Stressprov för det som räknar fram ljud och bild: stämning, ackordanalys,
 * klangfärger och taktvisarens läge. Här matas de med värden ingen körledare
 * skulle skriva in, men som en trasig inställningsfil mycket väl kan innehålla.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type LabelSystem,
  DEFAULT_LABELS,
  centsFromTempered,
  frequencyOf,
  isBlackKey,
  justFrequency,
  noteLabel,
  noteName,
  temperedFrequency,
} from '../src/theory/tuning.ts';
import { analyseraAckord } from '../src/theory/chords.ts';
import { beatPosition } from '../src/audio/beatPosition.ts';
import { TIMBRES } from '../src/audio/timbres.ts';
import { tempoFromTaps } from '../src/audio/tempo.ts';

const HELA_KLAVIATUREN = Array.from({ length: 128 }, (_, i) => i);

test('varje ton på klaviaturen ger en hörbar frekvens i båda stämningarna', () => {
  let lägst = Infinity;
  let högst = 0;
  for (const midi of HELA_KLAVIATUREN) {
    for (let tonika = 0; tonika < 12; tonika += 1) {
      for (const f of [
        temperedFrequency(midi),
        justFrequency(midi, tonika),
        frequencyOf(midi, { system: 'just', tonicPitchClass: tonika, a4: 440 }),
      ]) {
        assert.ok(Number.isFinite(f) && f > 0, `ogiltig frekvens för midi ${midi}`);
        lägst = Math.min(lägst, f);
        högst = Math.max(högst, f);
      }
      const cent = centsFromTempered(midi, {
        system: 'just',
        tonicPitchClass: tonika,
        a4: 440,
      });
      assert.ok(Math.abs(cent) < 20, `ren stämning avviker ${cent} cent vid midi ${midi}`);
    }
  }
  console.log(
    `  [omfång] 128 toner × 12 tonikor: ${lägst.toFixed(2)} Hz – ${(högst / 1000).toFixed(1)} kHz`,
  );
});

test('trasiga inställningar når fram till ljudmotorn', () => {
  // Inställningarna läses in med JSON.parse och läggs ovanpå standardvärdena
  // utan kontroll, så det här är vad en trasig fil kan ge frekvensräkningen.
  const värden = [NaN, Infinity, -Infinity, 0, -440, 1e308];
  const dåliga: string[] = [];
  for (const a4 of värden) {
    const f = frequencyOf(69, { system: 'tempered', tonicPitchClass: 0, a4 });
    const fRen = frequencyOf(64, { system: 'just', tonicPitchClass: 0, a4 });
    if (!Number.isFinite(f) || f <= 0 || !Number.isFinite(fRen) || fRen <= 0) {
      dåliga.push(`a4=${a4} → ${f} Hz / ${fRen} Hz (ren)`);
    }
  }
  for (const rad of dåliga) {
    console.log(`  [a4] ${rad}`);
  }
  assert.equal(
    dåliga.length,
    0,
    `${dåliga.length} av ${värden.length} kammartoner ger en frekvens ljudmotorn inte kan spela`,
  );
});

test('tonnamn och etiketter finns för varje tänkbar ton', () => {
  const saknade: string[] = [];
  for (const system of ['letters', 'solfege', 'degrees'] as LabelSystem[]) {
    for (const referens of ['c', 'tonic'] as const) {
      for (let tonika = 0; tonika < 12; tonika += 1) {
        for (const midi of [-24, -1, 0, 60, 127, 200]) {
          const etikett = noteLabel(midi, {
            ...DEFAULT_LABELS,
            system,
            reference: referens,
            tonicPitchClass: tonika,
          });
          if (typeof etikett !== 'string' || etikett.length === 0) {
            saknade.push(`${system}/${referens}/tonika ${tonika}/midi ${midi} → ${etikett}`);
          }
        }
      }
    }
  }
  for (const rad of saknade.slice(0, 5)) {
    console.log(`  [etikett saknas] ${rad}`);
  }
  assert.equal(saknade.length, 0, saknade[0]);
  assert.equal(typeof noteName(-13), 'string');
  assert.equal(typeof isBlackKey(-13), 'boolean');
});

test('ackordanalysen tål alla tonkombinationer på en klaviatur', () => {
  let namngivna = 0;
  let prövade = 0;
  const start = process.hrtime.bigint();
  // Alla delmängder av en oktav, i alla oktavlägen, med varje tänkbar tonika.
  for (let mask = 0; mask < 4096; mask += 1) {
    const toner: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      if (mask & (1 << i)) {
        toner.push(36 + i + 12 * (i % 4));
      }
    }
    for (const grundton of [null, 0, 6, 11]) {
      prövade += 1;
      const ackord = analyseraAckord(toner, grundton);
      if (ackord.namn) namngivna += 1;
      for (const [pc, stavning] of ackord.stavning) {
        assert.ok(pc >= 0 && pc < 12, `stavning för orimlig tonklass ${pc}`);
        assert.ok(stavning === 'sharp' || stavning === 'flat');
      }
    }
  }
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(
    `  [ackord] ${prövade} kombinationer på ${ms.toFixed(0)} ms, ${namngivna} fick namn`,
  );

  // Orimliga toner ska inte kunna stjälpa analysen.
  for (const udda of [[-1000], [1e6, -1e6], [NaN], [Infinity], [0.5, 1.5]]) {
    assert.doesNotThrow(() => analyseraAckord(udda), `ackord av ${udda}`);
  }
});

test('klangfärgerna håller sig inom hörbara nivåer', () => {
  for (const [id, timbre] of Object.entries(TIMBRES)) {
    for (const frekvens of [55, 261.63, 1046.5, 4186]) {
      const deltoner = timbre.partials(frekvens);
      assert.ok(deltoner.length > 0, `${id} saknar deltoner`);
      for (const d of deltoner) {
        assert.ok(Number.isFinite(d.ratio) && d.ratio > 0, `${id} har ogiltig delton`);
        assert.ok(d.gain >= 0 && d.gain <= 1, `${id} har delton utanför 0–1`);
      }
      const summa = deltoner.reduce((s, d) => s + d.gain, 0);
      assert.ok(summa > 0, `${id} summerar till tystnad`);
    }
    assert.ok(timbre.attack >= 0 && timbre.release > 0, `${id} har ogiltig envelopp`);
  }
  console.log(`  [klang] ${Object.keys(TIMBRES).length} klangfärger, alla inom sina gränser`);
});

test('taktvisaren står stilla i stället för att flyga iväg', () => {
  const lägen = [
    beatPosition(true, { at: 0, count: 0 }, 300, false, 1e12),
    beatPosition(true, { at: 1e12, count: 3 }, 30, false, 0),
    beatPosition(true, null, 0, true, 1000),
    beatPosition(true, { at: 0, count: -5 }, 90, false, 500),
    beatPosition(false, null, 90, false, 0),
  ];
  for (const l of lägen) {
    assert.ok(
      Number.isFinite(l.phase) && l.phase >= 0 && l.phase <= 1,
      `fas utanför 0–1: ${l.phase}`,
    );
    assert.ok(l.direction === 1 || l.direction === -1, `riktning ${l.direction}`);
  }
  console.log('  [taktvisare] alla ytterlägen ger en fas mellan 0 och 1');
});

test('knacktempo tål ojämna och orimliga knackningar', () => {
  const fall: [string, number[]][] = [
    ['två identiska tider', [1000, 1000]],
    ['bakåt i tiden', [5000, 4000, 3000]],
    ['en missad takt', [0, 500, 1000, 2000, 2500, 3000]],
    ['ett enda dubbeltryck', [0, 1]],
    ['mycket långsamt', [0, 60000]],
    ['tusen knackningar', Array.from({ length: 1000 }, (_, i) => i * 500)],
  ];
  for (const [namn, tider] of fall) {
    const bpm = tempoFromTaps(tider);
    console.log(`  [knack] ${namn.padEnd(22)} → ${bpm === null ? 'inget tempo' : bpm}`);
    assert.ok(
      bpm === null || (Number.isFinite(bpm) && bpm >= 30 && bpm <= 300),
      `${namn} gav ${bpm}`,
    );
  }
});
