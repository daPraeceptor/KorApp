/**
 * Vakt mot svenska som smyger tillbaka in i vyerna.
 *
 * Alla användarsynliga texter ska bo i ordlistorna, där engelskan är typad
 * mot svenskan. En sträng som skrivs rakt i en vy syns aldrig i typkontrollen
 * — den syns först hos en användare med fel språk. Därför sveper det här
 * provet vyerna efter strängliteraler med svenska tecken eller svenska ord.
 *
 * Kommentarer är undantagna: koden får resonera på svenska hur mycket den
 * vill, det är bara det som ritas som måste gå genom ordlistan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Vyerna och komponenterna — allt som ritar text. */
const VYER = [
  'App.tsx',
  'src/screens/PlayScreen.tsx',
  'src/screens/SongsScreen.tsx',
  'src/screens/SettingsScreen.tsx',
  'src/components/ui.tsx',
  'src/components/Keyboard.tsx',
  'src/components/TempoWheel.tsx',
  'src/components/MetronomeVisual.tsx',
  'src/components/VolumeNotice.tsx',
  'src/components/NoteValueIcon.tsx',
];

/** Svenska ord som avslöjar en användartext även utan å, ä eller ö. */
const SVENSKA_ORD =
  /\b(och|eller|inte|som|med|utan|bara|alla|när|denna|dessa|takt|slag|toner|mapp|spara|skapa|avbryt)\b/i;

function utanKommentarer(källa: string): string {
  return källa
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

test('vyerna bär inga hårdkodade svenska texter', () => {
  const träffar: string[] = [];
  for (const fil of VYER) {
    const källa = utanKommentarer(readFileSync(join(rot, fil), 'utf8'));
    for (const match of källa.matchAll(/(['"`])((?:(?!\1)[^\n])+)\1/g)) {
      const text = match[2];
      // Tekniska strängar: nycklar, mått, färger, tecken.
      if (text.length < 4 || /[{}<>=;#/\\]|^\d|^[A-Za-z_.-]+$/.test(text)) {
        continue;
      }
      if (/[åäöÅÄÖ]/.test(text) || SVENSKA_ORD.test(text)) {
        träffar.push(`${fil}: "${text.slice(0, 60)}"`);
      }
    }
    // JSX-textnoder: text som står rakt mellan taggarna, även över flera
    // rader. Det var så konsertlägets brödtext smet förbi första vakten.
    for (const match of källa.matchAll(/>\s*([A-ZÅÄÖa-zåäö][^<>{}]*?)\s*</gs)) {
      const text = match[1].replace(/\s+/g, ' ').trim();
      // Jämförelseoperatorer i kod ser också ut som > … < för mönstret.
      // Riktig text innehåller varken satsdelare eller anrop.
      if (text.length < 4 || /[;()=`]/.test(text)) {
        continue;
      }
      if (/[åäöÅÄÖ]/.test(text) || SVENSKA_ORD.test(text)) {
        träffar.push(`${fil} (JSX): "${text.slice(0, 60)}"`);
      }
    }
  }
  assert.deepEqual(
    träffar,
    [],
    `svensk text utanför ordlistan:\n  ${träffar.join('\n  ')}`,
  );
});

test('varje vy som ritar text hämtar den ur ordlistan', () => {
  // De vyer som har användartexter ska importera T. Komponenter helt utan
  // text är undantagna av sig själva.
  for (const fil of [
    'App.tsx',
    'src/screens/PlayScreen.tsx',
    'src/screens/SongsScreen.tsx',
    'src/screens/SettingsScreen.tsx',
    'src/components/VolumeNotice.tsx',
  ]) {
    const källa = readFileSync(join(rot, fil), 'utf8');
    assert.match(källa, /from '\.\.?\/(src\/)?i18n'/, `${fil} importerar inte ordlistan`);
  }
});
