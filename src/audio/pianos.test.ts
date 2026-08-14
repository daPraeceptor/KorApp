/**
 * Prov på pianomodellerna.
 *
 * Det som måste stämma här är tonhöjden. Appen finns till för att ge kören
 * en ton, och en klang som ligger några cent fel är värdelös hur vacker den
 * än är. Den fysikaliska modellen räknar fram sitt ljud sampel för sampel och
 * kan därför missa tonhöjden på ett sätt som en oscillator aldrig gör — så
 * den mäts efteråt, på det färdiga ljudet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fmRecept,
  renderaSträng,
  strängPartialer,
  strängTid,
  styvhet,
} from './pianos.ts';

const SAMPELFREKVENS = 48000;

/**
 * Grundtonens frekvens i ett färdigt ljud, mätt med autokorrelation.
 *
 * Bråkdelen av perioden fås med en parabel genom toppen och dess grannar.
 * Utan den räcker upplösningen inte till: ett helt sampel är över tre cent
 * vid A4, och det är mer fel än provet vill tillåta.
 */
function uppmättFrekvens(ljud: Float32Array, väntad: number): number {
  const start = Math.floor(0.2 * SAMPELFREKVENS);
  const längd = Math.floor(0.4 * SAMPELFREKVENS);
  const bit = ljud.subarray(start, start + längd);

  const väntadPeriod = SAMPELFREKVENS / väntad;
  const från = Math.max(2, Math.floor(väntadPeriod * 0.8));
  const till = Math.ceil(väntadPeriod * 1.25);

  const korrelation = (lag: number) => {
    let summa = 0;
    for (let i = 0; i + lag < bit.length; i += 1) {
      summa += bit[i] * bit[i + lag];
    }
    return summa;
  };

  let bäst = från;
  let bästVärde = -Infinity;
  for (let lag = från; lag <= till; lag += 1) {
    const v = korrelation(lag);
    if (v > bästVärde) {
      bästVärde = v;
      bäst = lag;
    }
  }

  const före = korrelation(bäst - 1);
  const efter = korrelation(bäst + 1);
  const nämnare = före - 2 * bästVärde + efter;
  const justering = nämnare === 0 ? 0 : (0.5 * (före - efter)) / nämnare;
  return SAMPELFREKVENS / (bäst + justering);
}

const cent = (från: number, till: number) => 1200 * Math.log2(till / från);

test('modellsträngen träffar tonhöjden över hela klaviaturen', () => {
  // C2, C3, A4 (kammartonen), C5 och C6 — hela det spann en kör får toner i.
  const värsta: string[] = [];
  for (const f of [65.41, 130.81, 440, 523.25, 1046.5]) {
    const ljud = renderaSträng(f, SAMPELFREKVENS);
    const uppmätt = uppmättFrekvens(ljud, f);
    const avvikelse = cent(f, uppmätt);
    console.log(
      `  ${f.toFixed(2)} Hz → uppmätt ${uppmätt.toFixed(2)} Hz (${avvikelse >= 0 ? '+' : ''}${avvikelse.toFixed(2)} cent)`,
    );
    if (Math.abs(avvikelse) > 2) {
      värsta.push(`${f} Hz ligger ${avvikelse.toFixed(2)} cent fel`);
    }
  }
  assert.equal(värsta.length, 0, värsta.join('; '));
});

test('det framräknade ljudet är hörbart och utan skräp', () => {
  for (const f of [65.41, 440, 1046.5]) {
    const ljud = renderaSträng(f, SAMPELFREKVENS);
    assert.ok(ljud.length > SAMPELFREKVENS, `${f} Hz gav ett för kort ljud`);
    let topp = 0;
    let summa = 0;
    for (const v of ljud) {
      assert.ok(Number.isFinite(v), `${f} Hz gav ett ogiltigt sampel`);
      topp = Math.max(topp, Math.abs(v));
      summa += v;
    }
    assert.ok(topp > 0.99 && topp <= 1.0001, `${f} Hz är inte normerad: topp ${topp}`);
    // En likspänningskomponent hörs inte men äter utstyrning och kan knäppa.
    assert.ok(
      Math.abs(summa / ljud.length) < 0.02,
      `${f} Hz har en likspänningskomponent på ${summa / ljud.length}`,
    );
  }
});

test('tonen klingar av, och gör det snabbare uppåt', () => {
  const nivåEfter = (f: number, sekunder: number) => {
    const ljud = renderaSträng(f, SAMPELFREKVENS);
    const från = Math.floor(sekunder * SAMPELFREKVENS);
    if (från >= ljud.length) {
      return 0;
    }
    let summa = 0;
    let antal = 0;
    for (let i = från; i < Math.min(ljud.length, från + SAMPELFREKVENS * 0.1); i += 1) {
      summa += ljud[i] * ljud[i];
      antal += 1;
    }
    return Math.sqrt(summa / Math.max(1, antal));
  };

  const bas = nivåEfter(130.81, 1) / nivåEfter(130.81, 0.05);
  const diskant = nivåEfter(1046.5, 1) / nivåEfter(1046.5, 0.05);
  console.log(
    `  kvar efter en sekund: C3 ${(bas * 100).toFixed(1)} %, C6 ${(diskant * 100).toFixed(1)} %`,
  );
  assert.ok(bas < 0.9, 'basen klingar inte av alls');
  assert.ok(diskant < bas, 'diskanten ska dö fortare än basen');
});

test('deltonerna sträcks uppåt, som på en styv sträng', () => {
  const partialer = strängPartialer(261.63);
  const grund = partialer[0];
  assert.ok(grund.ratio > 0.99 && grund.ratio < 1.01, 'grundtonen ligger fel');

  // En styv sträng lägger sina deltoner över de jämna multiplarna, och allt
  // mer ju högre upp man kommer. Åttan hoppas över med flit: den saknas,
  // se nästa prov.
  const B = styvhet(261.63);
  for (const n of [2, 3, 4, 6, 12]) {
    const väntat = n * Math.sqrt(1 + B * n * n);
    const närmast = partialer.reduce((bäst, p) =>
      Math.abs(p.ratio - väntat) < Math.abs(bäst.ratio - väntat) ? p : bäst,
    );
    assert.ok(
      Math.abs(närmast.ratio - väntat) < väntat * 0.002,
      `delton ${n} ligger på ${närmast.ratio}, väntade ${väntat}`,
    );
  }
  console.log(
    `  delton 12 ligger ${cent(12, 12 * Math.sqrt(1 + B * 144)).toFixed(1)} cent över den jämna multipeln`,
  );
});

test('ljusa deltoner dör före mörka', () => {
  const partialer = strängPartialer(261.63);
  const grundtid = partialer[0].decayScale ?? 0;
  const höga = partialer.filter((p) => p.ratio > 8);
  assert.ok(höga.length > 0, 'inga höga deltoner alls');
  for (const p of höga) {
    assert.ok(
      (p.decayScale ?? 0) < grundtid,
      `delton ${p.ratio} klingar lika länge som grundtonen`,
    );
  }
});

test('hammarens läge tystar var åttonde delton', () => {
  // Hammaren träffar en åttondel in på strängen. Just de deltoner som har en
  // nod där kan den inte sätta i rörelse alls — ett av de drag som skiljer en
  // slagen sträng från en dragen.
  const partialer = strängPartialer(261.63);
  for (const n of [8, 16]) {
    const nära = partialer.filter((p) => Math.abs(p.ratio - n) < 0.5);
    assert.equal(nära.length, 0, `delton ${n} skulle inte finnas: ${JSON.stringify(nära)}`);
  }
  console.log(`  ${partialer.length} deltoner, ingen på åtta eller sexton`);
});

test('modulatorerna hamnar aldrig ovanför hörselområdet', () => {
  // Deltoner som ligger för högt sållar ljudmotorn bort. FM:s sidband går
  // inte att sålla på samma sätt — de viker ner sig som orena metallklanger,
  // och det är det värsta som kan hända en tongivare. Klaviaturens högsta
  // ton är C8.
  for (const f of [261.63, 1046.5, 2093, 4186]) {
    const recept = fmRecept(f);
    if (recept.anslag) {
      assert.ok(
        recept.anslag.frekvens + recept.anslag.djup < 16000,
        `${f} Hz får ett anslagssidband på ${(recept.anslag.frekvens + recept.anslag.djup).toFixed(0)} Hz`,
      );
    }
    assert.ok(
      recept.kropp.frekvens + recept.kropp.djup < 20000,
      `${f} Hz får ett sidband på ${(recept.kropp.frekvens + recept.kropp.djup).toFixed(0)} Hz`,
    );
    // Grundtonen måste överleva ljudmotorns sållning, annars blir tonen tyst.
    const hörbara = strängPartialer(f).filter((p) => f * p.ratio <= 18000);
    assert.ok(hörbara.length > 0, `${f} Hz har ingen hörbar delton kvar`);
  }
});

/** Styrkan hos en enskild frekvens i ett ljud, mätt med en enda DFT-punkt. */
function styrkaVid(ljud: Float32Array, frekvens: number, från: number, längd: number): number {
  let re = 0;
  let im = 0;
  const steg = (2 * Math.PI * frekvens) / SAMPELFREKVENS;
  for (let i = 0; i < längd; i += 1) {
    const v = ljud[från + i];
    re += v * Math.cos(steg * i);
    im += v * Math.sin(steg * i);
  }
  return Math.sqrt(re * re + im * im) / längd;
}

/**
 * Besselfunktionen av första slaget, räknad som integral.
 *
 * Vid frekvensmodulering är sidbandens styrka Jn av moduleringsdjupet, och
 * det är enda sättet att veta om FM-klangen verkligen bär den femte deltonen
 * utan att lyssna. Integralen räcker gott: den behöver bara skilja "finns"
 * från "finns inte".
 */
function bessel(n: number, x: number): number {
  const steg = 20000;
  let summa = 0;
  for (let i = 0; i <= steg; i += 1) {
    const τ = (Math.PI * i) / steg;
    const vikt = i === 0 || i === steg ? 0.5 : 1;
    summa += vikt * Math.cos(n * τ - x * Math.sin(τ));
  }
  return summa / steg;
}

test('modellsträngen bär femte och sjätte deltonen', () => {
  // Utan dem finns skillnaden mellan tempererad och ren stämning inte i
  // ljudet, hur rätt frekvenserna än är räknade — det är hela grunden för att
  // appen alls kan visa ren stämning.
  const f = 261.63;
  const ljud = renderaSträng(f, SAMPELFREKVENS);
  const från = Math.floor(0.05 * SAMPELFREKVENS);
  const längd = Math.floor(0.3 * SAMPELFREKVENS);
  const grund = styrkaVid(ljud, f, från, längd);
  for (const n of [5, 6]) {
    // Strängen är styv, så deltonen ligger en aning över den jämna multipeln.
    const bäst = Math.max(
      ...[1, 1.004, 1.008, 1.012].map((sträck) =>
        styrkaVid(ljud, f * n * sträck, från, längd),
      ),
    );
    const andel = bäst / grund;
    console.log(`  delton ${n}: ${(andel * 100).toFixed(1)} % av grundtonen`);
    assert.ok(andel > 0.02, `delton ${n} är för svag för svävning: ${andel}`);
  }
});

test('FM-klangen bär femte och sjätte deltonen', () => {
  const recept = fmRecept(261.63);
  // Moduleringsdjupet delat med modulatorns frekvens är moduleringsindexet,
  // och sidband n har styrkan Jn av det.
  const index = recept.kropp.djup / recept.kropp.frekvens;
  const grund = Math.abs(bessel(0, index));
  for (const n of [5, 6]) {
    const andel = Math.abs(bessel(n, index)) / grund;
    console.log(`  sidband ${n}: ${(andel * 100).toFixed(1)} % av bärvågen`);
    assert.ok(andel > 0.02, `sidband ${n} är för svagt för svävning: ${andel}`);
  }
});

test('utklingningstiden följer klaviaturen', () => {
  const tider = [65.41, 261.63, 1046.5, 4186].map((f) => +strängTid(f).toFixed(2));
  console.log(`  C2 ${tider[0]} s · C4 ${tider[1]} s · C6 ${tider[2]} s · C8 ${tider[3]} s`);
  for (let i = 1; i < tider.length; i += 1) {
    assert.ok(tider[i] < tider[i - 1], 'högre toner ska klinga kortare');
  }
  assert.ok(tider[0] > 15, 'basen ska ligga kvar länge');
  assert.ok(tider[3] < 2, 'diskanten ska dö fort');
});
