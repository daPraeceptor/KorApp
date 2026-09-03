/**
 * Tangentspannet i låtlistans uppfällda kort. Reglerna är lätta att bryta
 * av misstag när tonerna ligger nära klaviaturens ändar, så de mäts här.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isBlackKey } from '../theory/tuning.ts';
import { fyllUtSpann, klaviaturSpann } from './klaviaturSpann.ts';

test('en ensam ton ger ändå en hel oktav', () => {
  const { från, till } = klaviaturSpann([60]);
  // Oktaven är golvet. Här landar båda ändarna på svarta tangenter och
  // skjuts ut ett steg var, så spannet blir två halvtoner bredare.
  assert.ok(till - från >= 12, 'spannet får aldrig understiga en oktav');
  assert.ok(från <= 60 && till >= 60, 'tonen måste rymmas i spannet');
});

test('breda tonuppsättningar får luft omkring sig', () => {
  const { från, till } = klaviaturSpann([53, 72]);
  // Två halvtoner under den lägsta tonen vore D#3, en svart tangent; spannet
  // går därför ut till D3. Uppåt räcker de två halvtonerna till vita D5.
  assert.equal(från, 50);
  assert.equal(till, 74);
});

test('spannet krymper inte vid klaviaturens nedre ände', () => {
  const { från, till } = klaviaturSpann([1]);
  assert.equal(från, 0);
  assert.equal(till - från, 12);
});

test('spannet krymper inte vid den övre änden', () => {
  const { från, till } = klaviaturSpann([126]);
  assert.equal(till, 127);
  assert.equal(till - från, 12);
});

test('utan toner visas en oktav ändå', () => {
  const { från, till } = klaviaturSpann([]);
  assert.equal(till - från, 12);
});

test('spannet börjar och slutar alltid på en vit tangent', () => {
  // Klaviaturens bredd räknas i vita tangenter. En svart ände ritas till
  // hälften utanför bilden, eller uteblir helt — därför prövas alla lägen.
  for (let ton = 0; ton <= 127; ton += 1) {
    const { från, till } = klaviaturSpann([ton]);
    assert.ok(!isBlackKey(från), `spannet för ton ${ton} börjar på svart`);
    assert.ok(!isBlackKey(till), `spannet för ton ${ton} slutar på svart`);
    assert.ok(från <= ton && ton <= till, `ton ${ton} hamnade utanför`);
    assert.ok(till - från >= 12, `spannet för ton ${ton} krympte`);
    assert.ok(från >= 0 && till <= 127, `spannet för ton ${ton} gick utanför`);
  }
});

test('svarta ändar skjuts utåt, inte inåt', () => {
  // Aftonens toner, F4 och A4: luften omkring dem landar på C#4 och C#5, två
  // svarta tangenter. Spannet ska växa till C4 och D5 — hade det i stället
  // krympt till D4 och C5 vore det två halvtoner smalare än en oktav.
  const { från, till } = klaviaturSpann([65, 69]);
  assert.equal(från, 60);
  assert.equal(till, 74);
});

test('stående skärm fyller inte på: spannet är redan bredare än ytan', () => {
  // Telefon på högkant, 390 × 844. Full tangenthöjd ger 52 breda tangenter,
  // och då ryms sex på ytan — långt färre än de femton spannet redan har.
  assert.equal(fyllUtSpann(48, 72, 350, 844), 72);
});

test('liggande skärm fyller på tangenter fram till kanten', () => {
  // Samma telefon nervänd, 844 × 390. Höjden tar slut först: tangenterna blir
  // 46,3 breda och sjutton ryms. Spannet har femton, så två läggs till — och
  // eftersom C#5 är svart hamnar änden på D5 och sedan E5.
  assert.equal(fyllUtSpann(48, 72, 800, 390), 76);
});

test('påfyllningen slutar aldrig på en svart tangent', () => {
  for (let bredd = 0; bredd <= 1600; bredd += 17) {
    for (const start of [24, 48, 60, 84]) {
      const till = fyllUtSpann(start, start + 24, bredd, 390);
      assert.ok(!isBlackKey(till), `bredd ${bredd} från ${start} slutar svart`);
      assert.ok(till >= start + 24, `bredd ${bredd} krympte spannet`);
      assert.ok(till <= 127, `bredd ${bredd} gick över klaviaturens ände`);
    }
  }
});

test('utan mätt yta lämnas spannet i fred', () => {
  // Första utritningen, innan omslaget hunnit mätas.
  assert.equal(fyllUtSpann(48, 72, 0, 390), 72);
});
