/**
 * Prov på att klangerna upplevs lika starka.
 *
 * Toppnivån säger ingenting om hur starkt något låter. En ren sinuston och en
 * körton kan toppa på samma värde och ändå skilja sig med sex decibel, för
 * styrkan sitter i hur mycket energi vågformen bär — och tätt liggande
 * deltoner förstärker varandra. Därför mäts RMS här, med ljudmotorns egna
 * regler, och därför bär varje klang en egen nivå.
 *
 * Flygeln går inte att mäta härifrån: dess ljud ligger i inspelade prov som
 * Node inte kan avkoda. Den är uppmätt i webbläsaren till RMS 0,054 vid full
 * toppnivå, vilket med nivån 2,4 ger 0,129 — samma mål som de andra.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TIMBRES, TIMBRE_ORDER } from './timbres.ts';

const SR = 48000;
const VOICE_PEAK = 0.5;
const SILENCE = 0.0001;
const C4 = 261.626;

/** Den nivå alla klanger ska landa på, mätt som RMS över en halv sekund. */
const MÅL = 0.13;

/** Web Audios exponentiella ramp, som ljudmotorn använder för deltonerna. */
const ramp = (från: number, till: number, tid: number, t: number) =>
  t <= 0 ? från : t >= tid ? till : från * Math.pow(till / från, t / tid);

/** Klangens styrka vid C4, byggd precis som ljudmotorn bygger den. */
function styrka(id: (typeof TIMBRE_ORDER)[number]): number {
  const k = TIMBRES[id];
  const toppnivå = VOICE_PEAK * (k.nivå ?? 1);
  const partialer = k.partials(C4).filter((p) => C4 * p.ratio <= 18000);
  const summa = partialer.reduce((s, p) => s + p.gain, 0) || 1;

  const fönster = Math.floor(0.5 * SR);
  const ut = new Float32Array(fönster);
  for (const p of partialer) {
    const nivå = (p.gain * toppnivå) / summa;
    const steg = (2 * Math.PI * C4 * p.ratio) / SR;
    const spann = k.partialDecay ? k.partialDecay * (p.decayScale ?? 1) : 0;
    for (let i = 0; i < fönster; i += 1) {
      const t = i / SR;
      const anslag = Math.min(1, t / Math.max(k.attack, 1e-6));
      const envelopp =
        t < k.attack + k.decay
          ? anslag *
            (1 - (1 - k.sustain) * Math.max(0, (t - k.attack) / Math.max(k.decay, 1e-6)))
          : k.sustain;
      const delton = spann ? ramp(nivå, Math.max(nivå * 0.02, SILENCE), spann, t) : nivå;
      ut[i] += Math.sin(steg * i) * delton * envelopp;
    }
  }

  let kvadratsumma = 0;
  for (const v of ut) {
    kvadratsumma += v * v;
  }
  return Math.sqrt(kvadratsumma / fönster);
}

/** Klangerna som går att räkna fram här; flygeln spelar inspelade prov. */
const SYNTETISKA = TIMBRE_ORDER.filter((id) => !TIMBRES[id].bygg);

test('alla syntesklanger ligger på samma upplevda nivå', () => {
  const avvikande: string[] = [];
  for (const id of SYNTETISKA) {
    const rms = styrka(id);
    const andel = rms / MÅL;
    console.log(
      `  ${id.padEnd(11)} rms ${rms.toFixed(4)}  (${((andel - 1) * 100).toFixed(0)} % från målet)`,
    );
    if (Math.abs(andel - 1) > 0.15) {
      avvikande.push(`${id} ligger ${((andel - 1) * 100).toFixed(0)} % från målet`);
    }
  }
  assert.deepEqual(avvikande, [], avvikande.join('; '));
});

test('ingen klang når över sin toppnivå', () => {
  // Tonbussen räknar med att en röst aldrig toppar över VOICE_PEAK. Håller
  // inte det klipper ackord trots uträkningen.
  for (const id of SYNTETISKA) {
    const k = TIMBRES[id];
    const toppnivå = VOICE_PEAK * (k.nivå ?? 1);
    assert.ok(
      toppnivå <= VOICE_PEAK + 1e-9,
      `${id} har nivån ${k.nivå} och toppar över taket`,
    );
  }
  // Flygeln lyfts över ett, men dess prov är inspelade så pass måttligt att
  // toppen ändå stannar på 0,42 av full utstyrning. Uppmätt i webbläsaren.
  const flygel = TIMBRES.salamander;
  assert.ok(flygel.nivå !== undefined && flygel.nivå > 1, 'flygeln ska lyftas');
  assert.ok(0.173 * flygel.nivå <= VOICE_PEAK, 'flygelns topp går över taket');
});
