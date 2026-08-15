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

const vyn = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'SettingsScreen.tsx'),
  'utf8',
);

test('upphovsmannen namnges', () => {
  assert.match(vyn, /Alexander Holm/, 'flygelns upphovsman måste stå i appen');
  assert.match(vyn, /Salamander Grand Piano/, 'verket måste namnges');
});

test('licensen anges, med länk', () => {
  assert.match(vyn, /CC BY 3\.0/, 'licensens namn måste stå utskrivet');
  assert.match(
    vyn,
    /creativecommons\.org\/licenses\/by\/3\.0/,
    'licensen måste gå att öppna',
  );
});

test('det framgår att proven är bearbetade', () => {
  // Tredje villkoret, och det som oftast glöms. Vi har valt ut, transponerat,
  // kapat och justerat nivån — allt sådant ska gå att läsa sig till.
  assert.match(vyn, /bearbetade/, 'ändringarna måste nämnas');
});
