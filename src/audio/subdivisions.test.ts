import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SUBDIVISION,
  SUBDIVISIONS,
  SUBDIVISION_ORDER,
  subdivisionOr,
  toSubdivisionId,
} from './subdivisions.ts';

test('alla underdelningar är listade en gång', () => {
  assert.equal(new Set(SUBDIVISION_ORDER).size, SUBDIVISION_ORDER.length);
  assert.deepEqual([...SUBDIVISION_ORDER].sort(), Object.keys(SUBDIVISIONS).sort());
});

test('varje underdelning börjar på taktslaget', () => {
  // Första läget måste vara noll, annars låter inte slaget självt.
  for (const id of SUBDIVISION_ORDER) {
    assert.equal(SUBDIVISIONS[id].offsets[0], 0, `${id} börjar inte på slaget`);
  }
});

test('lägena ligger inom taktslaget och i ordning', () => {
  for (const id of SUBDIVISION_ORDER) {
    const o = SUBDIVISIONS[id].offsets;
    for (let i = 0; i < o.length; i += 1) {
      assert.ok(o[i] >= 0 && o[i] < 1, `${id}: läget ${o[i]} ligger utanför taktslaget`);
      if (i > 0) {
        assert.ok(o[i] > o[i - 1], `${id}: lägena kommer i fel ordning`);
      }
    }
  }
});

test('de jämna underdelningarna är jämnt fördelade', () => {
  const jämna = { quarter: 1, eighth: 2, triplet: 3, sixteenth: 4 } as const;
  for (const [id, antal] of Object.entries(jämna)) {
    const o = SUBDIVISIONS[id as keyof typeof jämna].offsets;
    assert.equal(o.length, antal);
    o.forEach((värde, i) => {
      assert.ok(Math.abs(värde - i / antal) < 1e-9, `${id}: läge ${i} är inte jämnt`);
    });
  }
});

test('swing lägger andra klicket på triolens sista tredjedel', () => {
  // Det är vad som skiljer swing från punkterat: 2/3 mot 3/4.
  const swing = SUBDIVISIONS.swing8.offsets;
  assert.equal(swing.length, 2);
  assert.ok(Math.abs(swing[1] - 2 / 3) < 1e-9);

  const punkterat = SUBDIVISIONS.dotted8.offsets;
  assert.equal(punkterat.length, 2);
  assert.ok(Math.abs(punkterat[1] - 3 / 4) < 1e-9);

  assert.ok(punkterat[1] > swing[1], 'punkterat ska gunga hårdare än swing');
});

test('sextondelsswing gungar i båda halvorna', () => {
  const o = SUBDIVISIONS.swing16.offsets;
  assert.equal(o.length, 4);
  // Halvorna ska se likadana ut, bara förskjutna en halv taktdel.
  assert.ok(Math.abs(o[1] - o[0] - (o[3] - o[2])) < 1e-9, 'halvorna gungar olika');
  assert.ok(Math.abs(o[2] - 1 / 2) < 1e-9, 'andra halvan börjar mitt i slaget');
});

test('kvintolen ger fem jämna klick', () => {
  const o = SUBDIVISIONS.quintuplet.offsets;
  assert.equal(o.length, 5);
  o.forEach((värde, i) => assert.ok(Math.abs(värde - i / 5) < 1e-9));
});

test('bara de fyra vanliga visas utan att slås på', () => {
  const vanliga = SUBDIVISION_ORDER.filter((id) => !SUBDIVISIONS[id].advanced);
  assert.deepEqual(vanliga, ['quarter', 'eighth', 'triplet', 'sixteenth']);
});

test('gamla låtar med siffra läses som rätt underdelning', () => {
  // Underdelningen sparades förr som antalet klick per slag.
  assert.equal(toSubdivisionId(1), 'quarter');
  assert.equal(toSubdivisionId(2), 'eighth');
  assert.equal(toSubdivisionId(3), 'triplet');
  assert.equal(toSubdivisionId(4), 'sixteenth');
});

test('okända värden faller tillbaka på standard', () => {
  assert.equal(toSubdivisionId(99), DEFAULT_SUBDIVISION);
  assert.equal(toSubdivisionId('finns-inte'), DEFAULT_SUBDIVISION);
  assert.equal(toSubdivisionId(undefined), DEFAULT_SUBDIVISION);
  assert.equal(toSubdivisionId(null), DEFAULT_SUBDIVISION);
  assert.equal(subdivisionOr('borttagen').id, DEFAULT_SUBDIVISION);
});

test('namngivna värden läses rakt av', () => {
  for (const id of SUBDIVISION_ORDER) {
    assert.equal(toSubdivisionId(id), id);
  }
});
