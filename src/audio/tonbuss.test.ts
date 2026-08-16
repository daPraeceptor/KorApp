/**
 * Prov på tonbussen, körd genom den riktiga ljudmotorn.
 *
 * Puckeln som gav upphov till provet: trycker man fram en tongivning medan
 * den förra ännu klingar ut räknas båda tonerna, och bussen ställs lågt. När
 * den gamla svansen tystnar ett halvt sekund senare steg bussen igen — och
 * den nya tonen, som fortfarande låg kvar, svällde mitt i. Det hörs som ett
 * andra anslag efter det första, tydligast på liggande klanger som körtonen.
 *
 * Provet driver AudioEngine mot en påhittad ljudkontext och bokför varje
 * ändring bussen gör.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AudioEngine } from './engine.ts';

interface Ändring {
  värde: number;
  vid: number;
}

/** Ljudkontext som bara antecknar. Bussen är den andra gainen som skapas. */
function fejkkontext() {
  const gainar: { ändringar: Ändring[]; värde: number }[] = [];
  let nu = 0;

  const skapaParam = (start: number, log?: Ändring[]) => {
    const param = {
      value: start,
      setValueAtTime(v: number) {
        param.value = v;
        return param;
      },
      linearRampToValueAtTime(v: number, t: number) {
        param.value = v;
        log?.push({ värde: +v.toFixed(4), vid: +t.toFixed(3) });
        return param;
      },
      exponentialRampToValueAtTime(v: number) {
        param.value = v;
        return param;
      },
      cancelScheduledValues() {
        return param;
      },
    };
    return param;
  };

  const nod = () => ({ connect: () => undefined, disconnect: () => undefined });

  const ctx = {
    get currentTime() {
      return nu;
    },
    destination: nod(),
    state: 'running',
    sampleRate: 48000,
    createGain() {
      const ändringar: Ändring[] = [];
      const post = { ändringar, värde: 1 };
      gainar.push(post);
      return { ...nod(), gain: skapaParam(1, ändringar) };
    },
    createOscillator() {
      return {
        ...nod(),
        type: 'sine',
        frequency: skapaParam(440),
        start: () => undefined,
        stop: () => undefined,
      };
    },
    createBiquadFilter() {
      return { ...nod(), type: 'lowpass', frequency: skapaParam(1000), Q: skapaParam(1) };
    },
    createBuffer: () => ({ length: 0, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(0) }),
    createBufferSource: () => ({ ...nod(), buffer: null, playbackRate: skapaParam(1), start: () => undefined, stop: () => undefined }),
    decodeAudioData: async () => ({ length: 0, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(0) }),
    resume: async () => undefined,
    close: async () => undefined,
  };

  return {
    gainar,
    gåTill(tid: number) {
      nu = tid;
    },
    installera() {
      (globalThis as Record<string, unknown>).AudioContext = function () {
        return ctx;
      };
    },
  };
}

const vila = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('bussen svänger aldrig uppåt medan toner hörs', async () => {
  const fejk = fejkkontext();
  fejk.installera();

  const motor = new AudioEngine();
  motor.setTimbre('choir');

  // Första tongivningen: tre toner.
  await motor.playTones([261.63, 329.63, 392], { mode: 'together', chordDuration: 1.4 });
  await vila(30);

  // Andra trycket kommer medan den första ännu klingar ut — det är här
  // puckeln uppstod.
  await motor.playTones([261.63, 329.63, 392], { mode: 'together', chordDuration: 1.4 });
  await vila(30);

  // Den gamla tongivningens svansar tystnar (släpp 0,35 s + 0,15 s städning).
  await vila(600);

  // Bussen är den andra gainen motorn skapar: först master, sedan bussen.
  const buss = fejk.gainar[1];
  assert.ok(buss, 'ingen tonbuss skapades');

  const höjningar = buss.ändringar.filter(
    (ändring, i) => i > 0 && ändring.värde > buss.ändringar[i - 1].värde + 1e-9,
  );

  console.log(
    `  bussens väg: ${buss.ändringar.map((ä) => ä.värde).join(' → ') || '(orörd)'}`,
  );
  assert.deepEqual(
    höjningar,
    [],
    `bussen höjdes ${höjningar.length} gång(er) medan toner hördes`,
  );

  motor.dispose();
});

test('bussen sjunker när tonerna blir fler', async () => {
  const fejk = fejkkontext();
  fejk.installera();

  const motor = new AudioEngine();
  motor.setTimbre('choir');
  await motor.playTones([261.63, 329.63, 392, 523.25], { mode: 'together' });
  await vila(40);

  const buss = fejk.gainar[1];
  const sista = buss.ändringar[buss.ändringar.length - 1];
  assert.ok(sista, 'bussen ställdes aldrig');
  assert.ok(sista.värde < 1, `fyra toner lämnade bussen på ${sista.värde}`);
  console.log(`  fyra toner ställde bussen på ${sista.värde}`);

  motor.dispose();
});
