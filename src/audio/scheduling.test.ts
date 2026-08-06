/**
 * Prov på metronomens schemaläggning med en påhittad ljudmotor.
 *
 * Klickens exakta lägen är hela poängen med de ojämna underdelningarna, och
 * det går inte att höra efter i ett test. Här bokförs de i stället.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Metronome } from './metronome.ts';
import type { ClickVariant } from './engine.ts';

interface Klick {
  tid: number;
  variant: ClickVariant;
}

/** Ljudmotor som bara antecknar vad den blir ombedd att spela. */
function fejkmotor() {
  const klick: Klick[] = [];
  let nu = 0;
  return {
    klick,
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
        klick.push({ tid: +tid.toFixed(6), variant });
      },
    } as never,
  };
}

/** Kör metronomen tills den bokat in klick en bit in i framtiden. */
async function spela(subdivision: string, bpm: number, sekunder: number) {
  const f = fejkmotor();
  const m = new Metronome(f.motor);
  m.update({ bpm, beatsPerBar: 4, subdivision: subdivision as never });
  await m.start();
  // Stega framåt i småsteg så att fönstret hinner bokas in bit för bit.
  for (let tid = 0; tid <= sekunder; tid += 0.05) {
    f.gåTill(tid);
    (m as unknown as { scheduleWindow(): void }).scheduleWindow();
  }
  m.stop();
  return f.klick;
}

/** Klickens lägen inom det första hela taktslaget, som andelar. */
function lägenInomSlaget(klick: Klick[], beatSekunder: number) {
  const start = klick[0].tid;
  return klick
    .filter((k) => k.tid < start + beatSekunder - 1e-6)
    .map((k) => +((k.tid - start) / beatSekunder).toFixed(4));
}

const BPM = 60; // ett taktslag per sekund gör räkningen läsbar

test('fjärdedelar ger ett klick per taktslag', async () => {
  const klick = await spela('quarter', BPM, 3.5);
  assert.deepEqual(lägenInomSlaget(klick, 1), [0]);
});

test('åttondelar delar slaget mitt itu', async () => {
  const klick = await spela('eighth', BPM, 3.5);
  assert.deepEqual(lägenInomSlaget(klick, 1), [0, 0.5]);
});

test('åttondelsswing lägger andra klicket på två tredjedelar', async () => {
  // Det är det som gör swing till swing: lång, kort — inte hälften var.
  const klick = await spela('swing8', BPM, 3.5);
  assert.deepEqual(lägenInomSlaget(klick, 1), [0, 0.6667]);
});

test('punkterat gungar hårdare än swing', async () => {
  const swing = lägenInomSlaget(await spela('swing8', BPM, 3.5), 1);
  const punkterat = lägenInomSlaget(await spela('dotted8', BPM, 3.5), 1);
  assert.deepEqual(punkterat, [0, 0.75]);
  assert.ok(punkterat[1] > swing[1]);
});

test('sextondelsswing gungar i båda halvorna', async () => {
  const klick = await spela('swing16', BPM, 3.5);
  assert.deepEqual(lägenInomSlaget(klick, 1), [0, 0.3333, 0.5, 0.8333]);
});

test('kvintolen ger fem jämna klick', async () => {
  const klick = await spela('quintuplet', BPM, 3.5);
  assert.deepEqual(lägenInomSlaget(klick, 1), [0, 0.2, 0.4, 0.6, 0.8]);
});

test('taktslagen ligger kvar på jämna sekunder trots ojämn underdelning', async () => {
  // Swingen får förskjuta underdelningarna men aldrig själva pulsen.
  const klick = await spela('swing8', BPM, 4.5);
  const slag = klick.filter((k) => k.variant !== 'subdivision');
  const start = slag[0].tid;
  slag.forEach((k, i) => {
    assert.ok(
      Math.abs(k.tid - (start + i)) < 1e-6,
      `slag ${i} ligger på ${k.tid}, väntade ${start + i}`,
    );
  });
});

test('ettan accentueras en gång per takt', async () => {
  const klick = await spela('swing8', BPM, 8.5);
  const accenter = klick.filter((k) => k.variant === 'accent');
  const start = accenter[0].tid;
  // Fyra slag per takt vid ett slag i sekunden = accent var fjärde sekund.
  accenter.forEach((k, i) => {
    assert.ok(Math.abs(k.tid - (start + i * 4)) < 1e-6, `accent ${i} ligger fel`);
  });
});

test('underdelningarna klickar svagare än taktslaget', async () => {
  const klick = await spela('quintuplet', BPM, 2.5);
  const inomFörsta = klick.slice(0, 5);
  assert.notEqual(inomFörsta[0].variant, 'subdivision');
  for (const k of inomFörsta.slice(1)) {
    assert.equal(k.variant, 'subdivision');
  }
});
