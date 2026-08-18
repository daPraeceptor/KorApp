/**
 * Prov på ordlistorna och språkvalet.
 *
 * Att engelskan har samma nycklar som svenskan vaktas av typkontrollen.
 * Här provas det typerna inte når: att språkvalet läser listan rätt, att
 * funktionsnycklarna formar meningar på båda språken, och att intervall-
 * tabellen har tolv rader som stämmer med halvtonerna.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { väljSpråk } from './index.ts';
import { sv } from './texter.sv.ts';
import { en } from './texter.en.ts';

test('första kända språket i listan vinner', () => {
  assert.equal(väljSpråk(['sv-SE', 'en-US']), 'sv');
  assert.equal(väljSpråk(['en-GB', 'sv-SE']), 'en');
  assert.equal(väljSpråk(['de-DE', 'sv-SE']), 'sv', 'okända språk hoppas över');
  assert.equal(väljSpråk(['de-DE', 'fr-FR']), 'en', 'utan träff gäller engelska');
  assert.equal(väljSpråk([]), 'en');
});

test('pluralerna formar sig efter antalet, på båda språken', () => {
  assert.equal(sv.lista.antalLåtar(1), '1 låt');
  assert.equal(sv.lista.antalLåtar(2), '2 låtar');
  assert.equal(en.lista.antalLåtar(1), '1 song');
  assert.equal(en.lista.antalLåtar(2), '2 songs');
  assert.equal(sv.lista.mappenInnehåller(1), 'Mappen innehåller en låt.');
  assert.equal(en.lista.mappenInnehåller(3), 'The folder contains 3 songs.');
});

test('funktionsnycklarna tar med sitt värde i meningen', () => {
  for (const ordlista of [sv, en]) {
    assert.ok(ordlista.lista.taBortLåt('Aftonen').includes('Aftonen'));
    assert.ok(ordlista.lista.träffar(2, 'hage').includes('hage'));
    assert.ok(ordlista.spel.spelaTon('G3').includes('G3'));
    assert.ok(ordlista.inst.flyttbartText('do').includes('do'));
  }
});

test('intervalltabellen har tolv rader i halvtonsordning', () => {
  assert.equal(sv.intervall.length, 12);
  assert.equal(en.intervall.length, 12);
  assert.equal(sv.intervall[0], 'Prim');
  assert.equal(en.intervall[7], 'Fifth');
});
