/**
 * Prov på att tacket till flygelns upphovsman finns kvar.
 *
 * Det här är inte en fråga om artighet. Salamander Grand Piano är licensierad
 * under CC BY 3.0, som ställer tre villkor: upphovsmannen ska namnges,
 * licensen ska anges, och det ska framgå att materialet är bearbetat. Är
 * något av dem borta får appen inte längre använda ljudet — och det är den
 * sortens fel som ingen märker förrän någon annan gör det.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Texterna bor numera i ordlistorna, en per språk — och villkoren gäller
 * båda: en engelsk användare ska se samma tack som en svensk. Vyn läses
 * också, för att länken till licensen inte får försvinna ur den.
 */
const i18n = join(dirname(fileURLToPath(import.meta.url)), '..', 'i18n');
const svenska = readFileSync(join(i18n, 'texter.sv.ts'), 'utf8');
const engelska = readFileSync(join(i18n, 'texter.en.ts'), 'utf8');
const vyn = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'SettingsScreen.tsx'),
  'utf8',
);

test('upphovsmannen namnges, på båda språken', () => {
  for (const [språk, text] of [['svenska', svenska], ['engelska', engelska]] as const) {
    assert.match(text, /Alexander Holm/, `upphovsmannen saknas på ${språk}`);
    assert.match(text, /Salamander Grand Piano/, `verket saknas på ${språk}`);
  }
});

test('licensen anges på båda språken, med länk i vyn', () => {
  assert.match(svenska, /CC BY 3\.0/, 'licensens namn saknas på svenska');
  assert.match(engelska, /CC BY 3\.0/, 'licensens namn saknas på engelska');
  assert.match(
    vyn,
    /creativecommons\.org\/licenses\/by\/3\.0/,
    'licensen måste gå att öppna från vyn',
  );
});

test('det framgår att proven är bearbetade, på båda språken', () => {
  // Tredje villkoret, och det som oftast glöms. Vi har valt ut, transponerat,
  // kapat och justerat nivån — allt sådant ska gå att läsa sig till.
  assert.match(svenska, /bearbetade/, 'ändringarna måste nämnas på svenska');
  assert.match(engelska, /adapted/, 'ändringarna måste nämnas på engelska');
});
