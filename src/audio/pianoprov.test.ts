/**
 * Prov på att pianoprovens listor och filer hänger ihop.
 *
 * Ett prov som saknas hörs inte som ett fel utan som en ton som tyst byter
 * klang: grannprovet sträcks i stället, och ju längre bort det ligger desto
 * konstigare låter det. Sådant vill man veta av ett prov, inte av en kör.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROV, WEBBREGISTER } from './pianoprov.ts';

const rot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const provmapp = join(rot, 'assets', 'piano');

/** MIDI-numren i mobilappens lista, lästa som text: filen kräver Metro. */
function nativeProv(): number[] {
  const källa = readFileSync(join(rot, 'src', 'audio', 'pianoprov.native.ts'), 'utf8');
  return [...källa.matchAll(/\{ midi: (\d+), modul: require\('([^']+)'\) \}/g)].map(
    (m) => Number(m[1]),
  );
}

test('mobilappen bär hela klaviaturen', () => {
  const midi = nativeProv();
  assert.equal(midi.length, 30, 'antalet prov har ändrats');
  assert.equal(midi[0], 21, 'lägsta provet ska vara A0');
  assert.equal(midi[midi.length - 1], 108, 'högsta provet ska vara C8');
  // Ett prov var liten ters: aldrig mer än en och en halv halvtons sträckning.
  for (let i = 1; i < midi.length; i += 1) {
    assert.ok(
      midi[i] - midi[i - 1] <= 3,
      `glapp på ${midi[i] - midi[i - 1]} halvtoner mellan ${midi[i - 1]} och ${midi[i]}`,
    );
  }
});

test('webben bär körregistret', () => {
  const midi = PROV.map((p) => p.midi);
  assert.equal(midi.length, 17);
  assert.equal(Math.min(...midi), WEBBREGISTER.lägsta);
  assert.equal(Math.max(...midi), WEBBREGISTER.högsta);
  for (let i = 1; i < midi.length; i += 1) {
    assert.equal(midi[i] - midi[i - 1], 3, 'proven ska ligga en liten ters isär');
  }
});

test('varje prov i listorna finns som fil', () => {
  const saknade: string[] = [];
  for (const midi of new Set([...nativeProv(), ...PROV.map((p) => p.midi)])) {
    if (!existsSync(join(provmapp, `${midi}.ogg`))) {
      saknade.push(`${midi}.ogg`);
    }
  }
  assert.deepEqual(saknade, [], `prov saknas i assets/piano: ${saknade.join(', ')}`);
});

test('kopieringsverktyget och webblistan är överens om registret', () => {
  // Verktyget kan inte importera listan — det körs före bygget — så gränserna
  // står på två ställen. Det här provet är det som håller dem i takt.
  const verktyg = readFileSync(join(rot, 'verktyg', 'kopiera-webbprov.mjs'), 'utf8');
  const lägsta = Number(/const LÄGSTA = (\d+);/.exec(verktyg)?.[1]);
  const högsta = Number(/const HÖGSTA = (\d+);/.exec(verktyg)?.[1]);
  assert.equal(lägsta, WEBBREGISTER.lägsta, 'verktygets nedre gräns har glidit');
  assert.equal(högsta, WEBBREGISTER.högsta, 'verktygets övre gräns har glidit');
});

test('webbens prov väger det man tror', () => {
  // Sidan hämtar hela banken när flygeln väljs, så summan är vad en körledare
  // får vänta på första gången.
  let byte = 0;
  for (const { midi } of PROV) {
    byte += readFileSync(join(provmapp, `${midi}.ogg`)).length;
  }
  const mb = byte / 1048576;
  console.log(`  körregistret: ${PROV.length} prov, ${mb.toFixed(2)} MB`);
  assert.ok(mb < 3.5, `webbanken har vuxit till ${mb.toFixed(2)} MB`);
});
