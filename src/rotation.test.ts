import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ROTATION_VAL, fårVridas, type Rotation } from './rotation.ts';

test('konsertläget är det som gör skillnad', () => {
  // Inställningens hela poäng: telefonen får ligga ner på notstället, men
  // inte kasta om sig medan man skruvar på tempot.
  assert.equal(fårVridas('konsert', true), true, 'låst: ska få vridas');
  assert.equal(fårVridas('konsert', false), false, 'olåst: ska stå upp');
});

test('aldrig och alltid struntar i låset', () => {
  for (const låst of [true, false]) {
    assert.equal(fårVridas('aldrig', låst), false);
    assert.equal(fårVridas('alltid', låst), true);
  }
});

test('ett okänt värde låser hellre än vrider', () => {
  // Lagringen normaliserar bort skräp, men skulle något ta sig förbi ska
  // skärmen stå still snarare än att kasta om sig oväntat.
  assert.equal(fårVridas('struntprat' as Rotation, true), false);
});

test('varje val har namn och förklaring', () => {
  assert.deepEqual(
    ROTATION_VAL.map((v) => v.id),
    ['aldrig', 'konsert', 'alltid'],
  );
  for (const val of ROTATION_VAL) {
    assert.ok(val.label.length > 0, `${val.id} saknar namn`);
    assert.ok(val.beskrivning.length > 20, `${val.id} saknar förklaring`);
  }
});
