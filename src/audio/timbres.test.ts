import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_TIMBRE, TIMBRES, TIMBRE_ORDER, timbreOr } from './timbres.ts';

const C4 = 261.626;

test('alla klanger i listan finns och är listade en gång', () => {
  assert.equal(new Set(TIMBRE_ORDER).size, TIMBRE_ORDER.length);
  assert.deepEqual([...TIMBRE_ORDER].sort(), Object.keys(TIMBRES).sort());
});

test('körtonen är standard', () => {
  assert.equal(DEFAULT_TIMBRE, 'choir');
});

/**
 * Klanger som bygger sin egen ljudgraf beskriver sig inte med deltoner —
 * en FM-bärvåg och en modellerad sträng har inga att räkna upp. De provas
 * för sig i pianos.test.ts, på det ljud de faktiskt ger.
 */
const BESKRIVS_AV_DELTONER = TIMBRE_ORDER.filter((id) => !TIMBRES[id].bygg);

test('varje klang ger användbara deltoner', () => {
  for (const id of BESKRIVS_AV_DELTONER) {
    const partials = TIMBRES[id].partials(C4);
    // Sinustonen består med flit av en enda delton.
    assert.ok(partials.length >= 1, `${id} saknar deltoner`);
    for (const partial of partials) {
      assert.ok(
        Number.isFinite(partial.gain) && partial.gain > 0,
        `${id} har en delton utan giltig nivå`,
      );
      // Tongruppens strängar ligger snäppet på var sin sida om deltonen, så
      // den understa får ligga en aning under — men bara en aning.
      assert.ok(partial.ratio > 0.99, `${id} har en delton under grundtonen`);
    }
  }
});

test('varje klang har en grundton som dominerar eller bär tonhöjden', () => {
  for (const id of BESKRIVS_AV_DELTONER) {
    const partials = TIMBRES[id].partials(C4);
    // En tongrupps strängar stäms nästan lika, därför "nästan ett".
    const grundton = partials.find((p) => Math.abs(p.ratio - 1) < 0.01);
    assert.ok(grundton, `${id} saknar grundton`);
  }
});

test('klanger som utger sig för att visa stämningen bär femte och sjätte deltonen', () => {
  // Utan dem finns skillnaden mellan tempererad och ren stämning inte i ljudet,
  // hur rätt frekvenserna än är räknade.
  for (const id of BESKRIVS_AV_DELTONER.filter((x) => TIMBRES[x].revealsTuning)) {
    const partials = TIMBRES[id].partials(C4);
    for (const ratio of [5, 6]) {
      // En styv sträng lägger deltonen någon procent över den jämna
      // multipeln. Det är just den avvikelsen som gör ett piano till ett
      // piano, så leta efter den närmaste i stället för den exakta.
      const partial = partials.find((p) => Math.abs(p.ratio - ratio) < ratio * 0.05);
      assert.ok(partial, `${id} saknar delton ${ratio}`);
      const andel = partial.gain / partials[0].gain;
      assert.ok(
        andel >= 0.02,
        `${id}: delton ${ratio} ligger på ${andel.toFixed(3)} av grundtonen, för svagt för svävning`,
      );
    }
  }
});

test('anslagsklanger klingar av, liggande klanger gör det inte', () => {
  for (const id of ['piano'] as const) {
    assert.ok(TIMBRES[id].partialDecay, `${id} ska klinga av`);
    assert.ok(TIMBRES[id].sustain < 0.2, `${id} ska inte ligga kvar`);
  }
  for (const id of ['choir', 'flute', 'sine'] as const) {
    assert.equal(TIMBRES[id].partialDecay, undefined, `${id} ska ligga kvar`);
    assert.ok(TIMBRES[id].sustain > 0.5, `${id} ska ligga kvar`);
  }
});

test('anslagsklangernas ljusa deltoner dör före de mörka', () => {
  for (const id of ['piano'] as const) {
    const partials = TIMBRES[id].partials(C4);
    for (let i = 1; i < partials.length; i += 1) {
      const forra = partials[i - 1].decayScale ?? 1;
      const denna = partials[i].decayScale ?? 1;
      assert.ok(
        denna <= forra,
        `${id}: delton ${partials[i].ratio} klingar längre än den under`,
      );
    }
  }
});

test('inga deltoner hamnar över hörselområdet för höga toner', () => {
  // Klaviaturen går upp till C6. Deltoner över 18 kHz filtreras i motorn, men
  // en klang ska inte bestå av nästan bara sådana.
  const C6 = 1046.5;
  for (const id of BESKRIVS_AV_DELTONER) {
    const partials = TIMBRES[id].partials(C6);
    const horbara = partials.filter((p) => p.ratio * C6 <= 18000);
    // Grundtonen måste alltid finnas kvar, och klangen får inte tappa mer än
    // hälften av sina deltoner ens längst upp på klaviaturen.
    assert.ok(horbara.length >= 1, `${id} tappar grundtonen`);
    assert.ok(
      horbara.length >= partials.length / 2,
      `${id} tappar ${partials.length - horbara.length} av ${partials.length} deltoner`,
    );
  }
});

test('sinustonen är ärligt märkt', () => {
  // Utan övertoner finns inga sammanfallande deltoner att sväva mot, alltså
  // hörs inte skillnaden mellan tempererad och ren stämning.
  assert.equal(TIMBRES.sine.revealsTuning, false);
  assert.equal(TIMBRES.sine.partials(C4).length, 1);
});

test('en okänd klang faller tillbaka på standard i stället för att krascha', () => {
  assert.equal(timbreOr('ah').id, DEFAULT_TIMBRE);
  assert.equal(timbreOr('choir').id, 'choir');
});
