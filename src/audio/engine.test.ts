import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nästaBussnivå, tonbussNivå } from './engine.ts';
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

test('bussen stiger inte medan något hörs', () => {
  // Det här är puckeln: trycker man fram en ny tongivning medan den förra
  // klingar ut räknas båda, och bussen ställs lågt. När den gamla svansen
  // tar slut skulle bussen stiga — och den nya tonen svälla mitt i, som ett
  // andra anslag. En liggande klang avslöjar det direkt.
  const treToner = nästaBussnivå(1, 3);
  const sexUnderUtklingning = nästaBussnivå(treToner, 6);
  assert.ok(sexUnderUtklingning < treToner, 'fler toner ska sänka nivån');

  // Svansarna tystnar, tre toner kvar som fortfarande ljuder.
  const efteråt = nästaBussnivå(sexUnderUtklingning, 3);
  assert.equal(
    efteråt,
    sexUnderUtklingning,
    'nivån får inte stiga medan tonerna fortfarande hörs',
  );
});

test('bussen börjar om när allt tystnat', () => {
  const låg = nästaBussnivå(1, 8);
  assert.ok(låg < 1);
  assert.equal(nästaBussnivå(låg, 0), 1, 'i tystnad ska nivån återställas');
});

test('nivån sjunker så mycket som behövs, men inte mer', () => {
  let nivå = 1;
  for (const röster of [1, 2, 4, 8]) {
    const föregående = nivå;
    nivå = nästaBussnivå(nivå, röster);
    assert.ok(nivå <= föregående, `${röster} toner höjde nivån`);
    // Summan ska hålla sig under taket vid varje steg.
    assert.ok(röster * nivå * 0.5 <= 0.851, `${röster} toner summerar för högt`);
  }
});
