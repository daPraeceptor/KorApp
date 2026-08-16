/**
 * Prov på klaviaturens proportioner.
 *
 * En pianotangent känns igen på sin form. Blir den låg och bred ser
 * klaviaturen ut som en rad knappar, och det är precis vad som händer när
 * skärmen läggs ner: höjden tar slut medan bredden växer. Här bevakas att
 * formen håller sig, i stående som liggande, och att kant-till-kant-läget
 * fortfarande fyller ytan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { klaviaturmått } from './klaviaturmatt.ts';

/** Formen på en riktig tangent: höjden delad med bredden. */
const FORM = 184 / 52;

const skärmar = {
  'telefon stående': { bredd: 390, höjd: 844 },
  'telefon liggande': { bredd: 844, höjd: 390 },
  'liten telefon liggande': { bredd: 667, höjd: 375 },
  'surfplatta stående': { bredd: 820, höjd: 1180 },
  'skrivbord': { bredd: 1440, höjd: 900 },
};

test('tangenten behåller ungefär sin form på alla skärmar', () => {
  for (const [namn, skärm] of Object.entries(skärmar)) {
    for (const fyll of [false, true]) {
      const m = klaviaturmått(skärm.bredd - 40, 15, skärm.höjd, fyll);
      const form = m.tangenthöjd / m.tangentbredd;
      // Aldrig bredare än en och en halv gång sin proportion, aldrig smalare
      // än proportionen själv.
      assert.ok(
        form <= FORM + 0.01 && form >= FORM / 1.5 - 0.01,
        `${namn}${fyll ? ' (fyller bredden)' : ''}: ${m.tangentbredd.toFixed(0)}×${m.tangenthöjd.toFixed(0)} ger formen ${form.toFixed(2)}`,
      );
    }
  }
});

test('stående telefon ser ut precis som förut', () => {
  // Ändringen fick inte röra det vanliga fallet.
  const m = klaviaturmått(0, 15, 844, false);
  assert.equal(m.tangentbredd, 52);
  assert.equal(m.tangenthöjd, 184);
  assert.equal(m.svartbredd, 34);
  assert.equal(m.svarthöjd, 116);
});

test('liggande telefon krymper klaviaturen i stället för att platta till den', () => {
  const stående = klaviaturmått(350, 15, 844, true);
  const liggande = klaviaturmått(800, 15, 390, true);
  assert.ok(
    liggande.tangenthöjd < stående.tangenthöjd,
    'klaviaturen ska bli lägre när skärmen är låg',
  );
  assert.ok(
    liggande.tangenthöjd / liggande.tangentbredd > 2,
    `tangenten blev för bred: ${liggande.tangentbredd.toFixed(0)}×${liggande.tangenthöjd.toFixed(0)}`,
  );
  console.log(
    `  stående ${stående.tangentbredd.toFixed(0)}×${stående.tangenthöjd.toFixed(0)} · ` +
      `liggande ${liggande.tangentbredd.toFixed(0)}×${liggande.tangenthöjd.toFixed(0)}`,
  );
});

test('kant till kant fyller ytan när tonspannet är litet', () => {
  // En låt med några få toner ska ge en klaviatur som fyller kortet, inte en
  // stump i vänsterkanten.
  const vita = 8;
  const yta = 560;
  const m = klaviaturmått(yta, vita, 844, true);
  const täckning = (m.tangentbredd * vita) / yta;
  console.log(`  ${vita} tangenter på ${yta} px täcker ${(täckning * 100).toFixed(0)} %`);
  assert.ok(täckning > 0.6, `klaviaturen täcker bara ${(täckning * 100).toFixed(0)} % av ytan`);
});

test('svarta tangenter följer de vita', () => {
  for (const skärm of Object.values(skärmar)) {
    const m = klaviaturmått(skärm.bredd, 15, skärm.höjd, true);
    assert.ok(m.svartbredd < m.tangentbredd, 'svart tangent ska vara smalare');
    assert.ok(m.svarthöjd < m.tangenthöjd, 'svart tangent ska vara kortare');
    assert.ok(
      Math.abs(m.svartbredd / m.tangentbredd - 34 / 52) < 0.001,
      'förhållandet mellan svart och vit bredd har glidit',
    );
  }
});
