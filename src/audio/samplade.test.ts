/**
 * Prov på att det som behålls av flygelns prov räcker till det appen spelar.
 *
 * Kapningen finns för minnets skull: avkodat ljud är okomprimerat, och hela
 * banken vägde nära hundra megabyte. Men kapar man för hårt tystnar tonen
 * mitt i tongivningen, och det är svårt att upptäcka — det låter som att
 * något är fel med ljudet, inte som en bugg. Därför räknas kravet fram här
 * ur appens egna gränser i stället för att skrivas som en siffra.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PROVLÄNGD } from './samplade.ts';
import { TIMBRES } from './timbres.ts';
import { MIN_TONE_GAP_BPM } from '../store/songs.ts';

/** Ackordets längd, satt av ljudmotorns chordDuration. */
const ACKORD = 1;
/** Andelen av mellanrummet en ton får ljuda när de ges en i taget. */
const ANDEL_AV_MELLANRUMMET = 0.92;

test('provet räcker för den längsta ton appen spelar', () => {
  const släpp = TIMBRES.salamander.release;

  // En i taget, i det långsammaste tempo tongivningen tillåter.
  const längstaTon = (60 / MIN_TONE_GAP_BPM) * ANDEL_AV_MELLANRUMMET;
  const krav = Math.max(ACKORD, längstaTon) + släpp;

  console.log(
    `  ackord ${ACKORD} s · långsammaste tongivning ${längstaTon.toFixed(2)} s · ` +
      `släpp ${släpp} s → kräver ${krav.toFixed(2)} s, behåller ${PROVLÄNGD} s`,
  );
  assert.ok(
    PROVLÄNGD >= krav,
    `provet kapas vid ${PROVLÄNGD} s men tonen kan behöva ${krav.toFixed(2)} s`,
  );
});

test('kapningen lämnar marginal, men inte i onödan', () => {
  // Fyra sekunder skulle fördubbla minnet utan att någon knapp blir längre.
  assert.ok(PROVLÄNGD <= 3, `${PROVLÄNGD} s kostar mer minne än tongivningen kan använda`);
});
