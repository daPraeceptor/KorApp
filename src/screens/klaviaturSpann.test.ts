/**
 * Tangentspannet i låtlistans uppfällda kort. Reglerna är lätta att bryta
 * av misstag när tonerna ligger nära klaviaturens ändar, så de mäts här.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { klaviaturSpann } from './klaviaturSpann.ts';

test('en ensam ton ger ändå en hel oktav', () => {
  const { från, till } = klaviaturSpann([60]);
  assert.equal(till - från, 12);
  assert.ok(från <= 60 && till >= 60, 'tonen måste rymmas i spannet');
});

test('breda tonuppsättningar får luft omkring sig', () => {
  const { från, till } = klaviaturSpann([53, 72]);
  assert.equal(från, 51);
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
