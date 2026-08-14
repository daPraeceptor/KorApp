/**
 * Stressprov för metronomens schemaläggare.
 *
 * Provar sådant som inte händer i ett lugnt test: att ljudkortsklockan hoppar
 * framåt medan appen legat i bakgrunden, att körledaren skruvar på allt
 * samtidigt, och att den går i en timme utan att glida.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Metronome } from '../src/audio/metronome.ts';
import type { ClickVariant } from '../src/audio/engine.ts';
import { SUBDIVISION_ORDER } from '../src/audio/subdivisions.ts';

interface Klick {
  tid: number;
  variant: ClickVariant;
}

/** Ljudmotor som antecknar i stället för att låta, med en klocka vi styr. */
function fejkmotor(maxKlick = 5_000_000) {
  const klick: Klick[] = [];
  let nu = 0;
  return {
    klick,
    get nu() {
      return nu;
    },
    gåTill(tid: number) {
      nu = tid;
    },
    motor: {
      get currentTime() {
        return nu;
      },
      async ensure() {
        return { currentTime: nu } as never;
      },
      scheduleClick(tid: number, variant: ClickVariant) {
        if (klick.length >= maxKlick) {
          throw new Error('SKENAR: schemaläggaren bokar klick utan slut');
        }
        klick.push({ tid, variant });
      },
    } as never,
  };
}

function fönster(m: Metronome) {
  (m as unknown as { scheduleWindow(): void }).scheduleWindow();
}

test('bakgrundad app: klockan hoppar 30 sekunder', async () => {
  const f = fejkmotor();
  const m = new Metronome(f.motor);
  m.update({ bpm: 120, beatsPerBar: 4, subdivision: 'sixteenth' });
  await m.start();

  // Två sekunder normal gång.
  for (let t = 0; t <= 2; t += 0.02) {
    f.gåTill(t);
    fönster(m);
  }
  const föreHopp = f.klick.length;

  // Skärmen släcks, timern fryser, ljudkortets klocka går vidare.
  f.gåTill(32);
  const start = process.hrtime.bigint();
  fönster(m);
  const msPerFönster = Number(process.hrtime.bigint() - start) / 1e6;

  const nya = f.klick.slice(föreHopp);
  const iDetForflutna = nya.filter((k) => k.tid < 32);
  console.log(
    `  [hopp] ett enda fönster bokade ${nya.length} klick, varav ${iDetForflutna.length} ` +
      `redan passerade (spelas alla på samma millisekund). ${msPerFönster.toFixed(1)} ms.`,
  );

  m.stop();
  assert.ok(
    iDetForflutna.length <= 8,
    `${iDetForflutna.length} klick i det förflutna schemaläggs samtidigt vid uppvaknandet`,
  );
});

test('webbfliken stryps till ett fönster i sekunden', async () => {
  // En dold flik får setInterval en gång per sekund i stället för var 25:e ms.
  const f = fejkmotor();
  const m = new Metronome(f.motor);
  m.update({ bpm: 200, beatsPerBar: 4, subdivision: 'eighth' });
  await m.start();

  for (let t = 1; t <= 10; t += 1) {
    f.gåTill(t);
    fönster(m);
  }
  const efterslapp = f.klick.filter((k) => k.tid < 10 - 0.12);
  // Alla klick som bokas efter att deras tid passerat blir hörbart klumpade.
  const klumpade = f.klick.filter((k, i) => i > 0 && k.tid < f.klick[i - 1].tid + 1e-9);
  console.log(
    `  [strypt flik] ${f.klick.length} klick bokade, ${efterslapp.length} av dem i efterhand, ` +
      `${klumpade.length} ur ordning.`,
  );
  m.stop();
});

test('en timme i högsta tempo glider inte', async () => {
  const f = fejkmotor();
  const m = new Metronome(f.motor);
  m.update({ bpm: 300, beatsPerBar: 4, subdivision: 'sixteenth' });
  await m.start();

  const start = process.hrtime.bigint();
  for (let t = 0; t <= 3600; t += 0.025) {
    f.gåTill(t);
    fönster(m);
  }
  const sekunder = Number(process.hrtime.bigint() - start) / 1e9;

  const slag = f.klick.filter((k) => k.variant !== 'subdivision');
  const första = slag[0].tid;
  const sista = slag[slag.length - 1].tid;
  const väntat = första + (slag.length - 1) * (60 / 300);
  const glidCent = Math.abs(sista - väntat) * 1000;
  console.log(
    `  [uthållighet] ${f.klick.length} klick på 3600 s simulerad tid ` +
      `(${sekunder.toFixed(1)} s räknat). Glidning efter en timme: ${glidCent.toFixed(4)} ms.`,
  );
  m.stop();
  assert.ok(glidCent < 1, `metronomen glider ${glidCent} ms på en timme`);
});

test('körledaren skruvar på allt medan den går', async () => {
  const f = fejkmotor();
  const m = new Metronome(f.motor);
  await m.start();

  let frö = 12345;
  const slump = () => {
    frö = (frö * 1103515245 + 12345) % 2147483648;
    return frö / 2147483648;
  };

  for (let t = 0; t <= 120; t += 0.02) {
    f.gåTill(t);
    if (slump() < 0.3) {
      m.update({
        bpm: 30 + Math.floor(slump() * 271),
        beatsPerBar: 1 + Math.floor(slump() * 12),
        subdivision: SUBDIVISION_ORDER[Math.floor(slump() * SUBDIVISION_ORDER.length)],
        accentFirstBeat: slump() < 0.5,
      });
    }
    fönster(m);
  }

  const iOrdning = f.klick.every((k, i) => i === 0 || k.tid >= f.klick[i - 1].tid - 1e-9);
  const alltGiltigt = f.klick.every((k) => Number.isFinite(k.tid));
  console.log(
    `  [skruvande] ${f.klick.length} klick under 120 s av ständiga ändringar. ` +
      `I tidsordning: ${iOrdning}.`,
  );
  m.stop();
  assert.ok(alltGiltigt, 'klick bokades på ogiltiga tider');
  assert.ok(iOrdning, 'klick bokades i fel tidsordning efter en ändring');
});

test('trasiga värden får inte låsa schemaläggaren', async () => {
  for (const bpm of [NaN, Infinity, -Infinity, 0, -120]) {
    const f = fejkmotor(200_000);
    const m = new Metronome(f.motor);
    await m.start();
    m.update({ bpm });
    f.gåTill(1);
    let fel: unknown = null;
    try {
      fönster(m);
    } catch (e) {
      fel = e;
    }
    m.stop();
    console.log(
      `  [trasigt bpm ${String(bpm)}] tillstånd=${m.getState().bpm}, ` +
        `klick=${f.klick.length}${fel ? ' — SKENADE' : ''}`,
    );
    assert.equal(fel, null, `bpm ${String(bpm)} fick schemaläggaren att skena`);
  }
});
