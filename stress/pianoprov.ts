/**
 * Renderar de tre pianoförsöken till ljudfiler, så att de går att lyssna på.
 *
 * Skriptet läser samma parametrar som appen — deltoner ur strängPartialer,
 * FM-uppställningen ur fmRecept, strängen ur renderaSträng — och bygger upp
 * samma ljudgraf som ljudmotorn gör, fast med tal i stället för ljudnoder.
 * Det är alltså inte en efterhärmning av klangen utan samma recept, lagat i
 * ett annat kök.
 *
 *   node stress/pianoprov.ts <mapp>
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { fmRecept, renderaSträng, strängPartialer } from '../src/audio/pianos.ts';
import { TIMBRES, type TimbreId } from '../src/audio/timbres.ts';

const SR = 48000;
/** Samma toppnivå per ton som ljudmotorn använder. */
const VOICE_PEAK = 0.5;
const TYST = 0.0001;

/** Web Audios exponentiella ramp: värdet vid en tidpunkt under rampen. */
function ramp(från: number, till: number, tid: number, t: number): number {
  if (t <= 0) return från;
  if (t >= tid) return till;
  return från * Math.pow(till / från, t / tid);
}

/** Ljudmotorns envelopp: kort anslag, och släpp först när tonen lämnas. */
function envelopp(id: TimbreId, t: number, längd: number): number {
  const klang = TIMBRES[id];
  const anslag = Math.min(1, t / Math.max(klang.attack, 1e-6));
  const kvar = längd - t;
  const släpp = kvar >= klang.release ? 1 : Math.max(0, kvar / klang.release);
  return anslag * släpp;
}

function additivTon(f0: number, längd: number): Float32Array {
  const partialer = strängPartialer(f0).filter((p) => f0 * p.ratio <= 18000);
  const summa = partialer.reduce((s, p) => s + p.gain, 0) || 1;
  const ut = new Float32Array(Math.floor(längd * SR));

  for (const p of partialer) {
    const nivå = (p.gain * VOICE_PEAK) / summa;
    const spann = p.decayScale ?? 1;
    const vinkelsteg = (2 * Math.PI * f0 * p.ratio) / SR;
    for (let i = 0; i < ut.length; i += 1) {
      const t = i / SR;
      ut[i] +=
        Math.sin(vinkelsteg * i) *
        ramp(nivå, Math.max(nivå * 0.02, TYST), spann, t) *
        envelopp('pianoStrangar', t, längd);
    }
  }
  return ut;
}

function fmTon(f0: number, längd: number): Float32Array {
  const recept = fmRecept(f0);
  const ut = new Float32Array(Math.floor(längd * SR));
  let fas = 0;
  const modulatorer = [recept.kropp, recept.anslag].filter(
    (m): m is NonNullable<typeof m> => m !== null,
  );
  const modFas = modulatorer.map(() => 0);

  for (let i = 0; i < ut.length; i += 1) {
    const t = i / SR;
    // Modulatorerna läggs till bärvågens frekvens, precis som när deras
    // utgång kopplas till frequency-parametern i ljudmotorn.
    let avvikelse = 0;
    modulatorer.forEach((m, index) => {
      const djup = ramp(m.djup, TYST, m.tid, t);
      avvikelse += Math.sin(modFas[index]) * djup;
      modFas[index] += (2 * Math.PI * m.frekvens) / SR;
    });

    ut[i] =
      Math.sin(fas) *
      ramp(VOICE_PEAK, VOICE_PEAK * 0.02, recept.tid, t) *
      envelopp('pianoFM', t, längd);
    fas += (2 * Math.PI * Math.max(0, recept.bärvåg + avvikelse)) / SR;
  }
  return ut;
}

function modellTon(f0: number, längd: number): Float32Array {
  const data = renderaSträng(f0, SR);
  const ut = new Float32Array(Math.floor(längd * SR));
  for (let i = 0; i < ut.length; i += 1) {
    const t = i / SR;
    ut[i] = (data[i] ?? 0) * VOICE_PEAK * envelopp('pianoModell', t, längd);
  }
  return ut;
}

const MODELLER: Record<string, (f0: number, längd: number) => Float32Array> = {
  strangar: additivTon,
  fm: fmTon,
  modell: modellTon,
};

/** Lägger ihop toner till ett spår, med tystnad emellan. */
function spår(
  ton: (f0: number, längd: number) => Float32Array,
  delar: { frekvenser: number[]; längd: number; paus: number }[],
): { ljud: Float32Array; topp: number } {
  const total = delar.reduce((s, d) => s + d.längd + d.paus, 0);
  const ut = new Float32Array(Math.ceil(total * SR));
  let vid = 0;
  let topp = 0;
  for (const del of delar) {
    const start = Math.floor(vid * SR);
    for (const f of del.frekvenser) {
      const bit = ton(f, del.längd);
      for (let i = 0; i < bit.length && start + i < ut.length; i += 1) {
        ut[start + i] += bit[i];
      }
    }
    vid += del.längd + del.paus;
  }
  for (const v of ut) {
    topp = Math.max(topp, Math.abs(v));
  }
  return { ljud: ut, topp };
}

/** 16 bitars mono-WAV. */
function wav(ljud: Float32Array, skalning: number): Buffer {
  const data = Buffer.alloc(ljud.length * 2);
  for (let i = 0; i < ljud.length; i += 1) {
    const v = Math.max(-1, Math.min(1, ljud[i] * skalning));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const huvud = Buffer.alloc(44);
  huvud.write('RIFF', 0);
  huvud.writeUInt32LE(36 + data.length, 4);
  huvud.write('WAVE', 8);
  huvud.write('fmt ', 12);
  huvud.writeUInt32LE(16, 16);
  huvud.writeUInt16LE(1, 20);
  huvud.writeUInt16LE(1, 22);
  huvud.writeUInt32LE(SR, 24);
  huvud.writeUInt32LE(SR * 2, 28);
  huvud.writeUInt16LE(2, 32);
  huvud.writeUInt16LE(16, 34);
  huvud.write('data', 36);
  huvud.writeUInt32LE(data.length, 40);
  return Buffer.concat([huvud, data]);
}

const mapp = process.argv[2] ?? '.';

// En ensam ton, sedan ett C-durackord: först var för sig, sedan tillsammans.
// Det är så tongivningen faktiskt används.
const DELAR = [
  { frekvenser: [261.63], längd: 3, paus: 0.4 },
  { frekvenser: [130.81], längd: 3, paus: 0.4 },
  { frekvenser: [1046.5], längd: 2, paus: 0.4 },
  { frekvenser: [261.63, 329.63, 392.0, 523.25], längd: 4, paus: 0.2 },
];

for (const [namn, ton] of Object.entries(MODELLER)) {
  const start = Date.now();
  const { ljud, topp } = spår(ton, DELAR);
  const fil = join(mapp, `piano-${namn}.wav`);
  // Filen normeras för lyssningens skull; toppvärdet skrivs ut som det är,
  // eftersom det är det som avgör om appen klipper.
  writeFileSync(fil, wav(ljud, 0.89 / Math.max(topp, 1e-9)));
  console.log(
    `${namn.padEnd(9)} topp ${topp.toFixed(2)} (över 1,0 = klipper i appen)  ` +
      `${((Date.now() - start) / 1000).toFixed(1)} s att räkna  →  ${fil}`,
  );
}
