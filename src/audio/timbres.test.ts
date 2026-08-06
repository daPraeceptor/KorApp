import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_TIMBRE, TIMBRES, TIMBRE_ORDER } from './timbres.ts';

const C4 = 261.626;

test('alla klanger i listan finns och är listade en gång', () => {
  assert.equal(new Set(TIMBRE_ORDER).size, TIMBRE_ORDER.length);
  assert.deepEqual([...TIMBRE_ORDER].sort(), Object.keys(TIMBRES).sort());
});

test('körtonen är standard', () => {
  assert.equal(DEFAULT_TIMBRE, 'choir');
});

test('varje klang ger användbara deltoner', () => {
  for (const id of TIMBRE_ORDER) {
    const partials = TIMBRES[id].partials(C4);
    assert.ok(partials.length >= 4, `${id} har för få deltoner`);
    for (const partial of partials) {
      assert.ok(
        Number.isFinite(partial.gain) && partial.gain > 0,
        `${id} har en delton utan giltig nivå`,
      );
      assert.ok(partial.ratio >= 1, `${id} har en delton under grundtonen`);
    }
  }
});

test('varje klang har en grundton som dominerar eller bär tonhöjden', () => {
  for (const id of TIMBRE_ORDER) {
    const partials = TIMBRES[id].partials(C4);
    const grundton = partials.find((p) => p.ratio === 1);
    assert.ok(grundton, `${id} saknar grundton`);
  }
});

test('alla klanger bär femte och sjätte deltonen', () => {
  // Utan dem finns skillnaden mellan tempererad och ren stämning inte i ljudet,
  // hur rätt frekvenserna än är räknade. Det gäller varje valbar klang.
  for (const id of TIMBRE_ORDER) {
    const partials = TIMBRES[id].partials(C4);
    for (const ratio of [5, 6]) {
      const partial = partials.find((p) => p.ratio === ratio);
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
  for (const id of ['piano', 'glockenspiel'] as const) {
    assert.ok(TIMBRES[id].partialDecay, `${id} ska klinga av`);
    assert.ok(TIMBRES[id].sustain < 0.2, `${id} ska inte ligga kvar`);
  }
  for (const id of ['choir', 'flute', 'ah', 'oh'] as const) {
    assert.equal(TIMBRES[id].partialDecay, undefined, `${id} ska ligga kvar`);
    assert.ok(TIMBRES[id].sustain > 0.5, `${id} ska ligga kvar`);
  }
});

test('anslagsklangernas ljusa deltoner dör före de mörka', () => {
  for (const id of ['piano', 'glockenspiel'] as const) {
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

test('vokalerna formas av sina formanter', () => {
  const styrka = (id: 'ah' | 'oh', hz: number) => {
    const partials = TIMBRES[id].partials(C4);
    const traff = partials.reduce((bast, p) =>
      Math.abs(p.ratio * C4 - hz) < Math.abs(bast.ratio * C4 - hz) ? p : bast,
    );
    return traff.gain;
  };
  // «ah» har sin första formant kring 730 Hz, «oh» kring 450 Hz.
  assert.ok(styrka('ah', 730) > styrka('ah', 450), 'ah ska vara ljusare');
  assert.ok(styrka('oh', 450) > styrka('oh', 1090), 'oh ska vara mörkare');
});

test('vokalerna skiljer sig hörbart från varandra', () => {
  const ah = TIMBRES.ah.partials(C4);
  const oh = TIMBRES.oh.partials(C4);
  const tyngdpunkt = (list: typeof ah) => {
    const summa = list.reduce((s, p) => s + p.gain, 0);
    return list.reduce((s, p) => s + p.ratio * C4 * p.gain, 0) / summa;
  };
  const skillnad = tyngdpunkt(ah) - tyngdpunkt(oh);
  assert.ok(skillnad > 100, `klangtyngdpunkterna skiljer bara ${skillnad.toFixed(0)} Hz`);
});

test('inga deltoner hamnar över hörselområdet för höga toner', () => {
  // Klaviaturen går upp till C6. Deltoner över 18 kHz filtreras i motorn, men
  // en klang ska inte bestå av nästan bara sådana.
  const C6 = 1046.5;
  for (const id of TIMBRE_ORDER) {
    const partials = TIMBRES[id].partials(C6);
    const horbara = partials.filter((p) => p.ratio * C6 <= 18000);
    assert.ok(horbara.length >= 4, `${id} tappar för många deltoner högt upp`);
  }
});
