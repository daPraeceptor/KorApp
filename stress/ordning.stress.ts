/**
 * Vad som händer med klicken i det ögonblick underdelningen byts under gång.
 */
import { test } from 'node:test';

import { Metronome } from '../src/audio/metronome.ts';
import type { ClickVariant } from '../src/audio/engine.ts';

function fejkmotor() {
  const klick: { tid: number; variant: ClickVariant }[] = [];
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
        klick.push({ tid: +tid.toFixed(4), variant });
      },
    } as never,
  };
}

test('byte av underdelning mitt i ett taktslag', async () => {
  const f = fejkmotor();
  const m = new Metronome(f.motor);
  // 60 bpm: ett taktslag per sekund gör tiderna läsbara.
  m.update({ bpm: 60, subdivision: 'sixteenth', beatsPerBar: 4 });
  await m.start();

  for (let t = 0; t <= 1.5; t += 0.02) {
    f.gåTill(t);
    (m as never as { scheduleWindow(): void }).scheduleWindow();
  }
  console.log('  före bytet:', JSON.stringify(f.klick));

  // Körledaren byter till fjärdedelar när vi står mitt i andra taktslaget.
  m.update({ subdivision: 'quarter' });
  for (let t = 1.5; t <= 3; t += 0.02) {
    f.gåTill(t);
    (m as never as { scheduleWindow(): void }).scheduleWindow();
  }
  console.log('  efter bytet:', JSON.stringify(f.klick.slice(-8)));

  let störstBakåt = 0;
  f.klick.forEach((k, i) => {
    if (i > 0) {
      störstBakåt = Math.min(störstBakåt, k.tid - f.klick[i - 1].tid);
    }
  });
  console.log(`  största steg bakåt i tiden: ${störstBakåt.toFixed(4)} s`);
  m.stop();
});
