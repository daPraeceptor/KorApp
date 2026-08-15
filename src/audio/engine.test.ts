import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tonbussNivå } from './engine.ts';
import { MAX_TONES } from '../store/songs.ts';

/** Toppnivån ljudkortet klarar innan det klipper. */
const TAK = 1;

test('en ensam ton låter precis som förut', () => {
  // Det vanligaste fallet får inte bli svagare av att flerstämmigheten skyddas.
  assert.equal(tonbussNivå(1), 0.5);
});

test('hur många toner som än ges klipper de inte tillsammans', () => {
  // Toner som startar samtidigt börjar alla på fasen noll, så ackordets topp
  // ligger nära summan av tonernas nivåer. Det är den summan som räknas här.
  for (let röster = 1; röster <= 16; röster += 1) {
    const summa = röster * tonbussNivå(röster);
    assert.ok(
      summa <= TAK,
      `${röster} toner summerar till ${summa.toFixed(2)}, över full utstyrning`,
    );
  }
  const värsta = MAX_TONES * tonbussNivå(MAX_TONES);
  console.log(
    `  ${MAX_TONES} toner (så många en låt kan bära) summerar till ${värsta.toFixed(2)}`,
  );
});

test('nivån sjunker aldrig mer än den behöver', () => {
  for (let röster = 2; röster <= 16; röster += 1) {
    const denna = tonbussNivå(röster);
    const förra = tonbussNivå(röster - 1);
    assert.ok(denna <= förra, `${röster} toner gav en högre nivå än ${röster - 1}`);
    // Halva utrymmet skulle vara att slösa: taket ska utnyttjas.
    assert.ok(
      röster * denna > 0.5,
      `${röster} toner utnyttjar bara ${(röster * denna).toFixed(2)} av taket`,
    );
  }
});

test('orimliga antal ger ändå en spelbar nivå', () => {
  for (const antal of [0, -3, NaN, 0.4]) {
    const nivå = tonbussNivå(antal);
    assert.ok(
      Number.isFinite(nivå) && nivå > 0 && nivå <= 0.5,
      `${String(antal)} röster gav nivån ${nivå}`,
    );
  }
});
