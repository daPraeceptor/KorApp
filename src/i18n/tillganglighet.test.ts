/**
 * Vakt för tillgängligheten.
 *
 * En skärmläsare hör bara det som uttryckligen berättas: en knapp utan
 * etikett läses som «knapp», ett hjul utan justerbar-roll går inte att vrida
 * alls. Sådant syns aldrig i typkontrollen och märks sällan av den som ser —
 * därför prövas källkoden på att de bärande delarna behåller sina roller.
 *
 * Provet läser källan i stället för att rendera: det som vaktas är att
 * egenskaperna finns kvar där de hör hemma, inte hur plattformen ritar dem.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const läs = (fil: string) => readFileSync(join(rot, fil), 'utf8');

test('byggstenarna bär roller och etiketter', () => {
  const ui = läs('src/components/ui.tsx');
  // Knappen: rollen och etiketten — etiketten är skärmläsarens enda namn
  // när en ikon ersätter texten.
  assert.match(ui, /accessibilityRole="button"/);
  assert.match(ui, /accessibilityLabel=\{label\}/);
  // Stegknapparna heter något, inte bara − och +.
  assert.match(ui, /T\.uppläst\.minska/);
  assert.match(ui, /T\.uppläst\.öka/);
  // Skjutreglaget går att justera utan dragning.
  assert.match(ui, /accessibilityRole="adjustable"/);
  // Draglåset går att utföra utan gest.
  assert.match(ui, /name: 'activate'/);
});

test('tempohjulet går att vrida med skärmläsare', () => {
  const hjul = läs('src/components/TempoWheel.tsx');
  assert.match(hjul, /accessibilityRole="adjustable"/);
  assert.match(hjul, /increment/);
  assert.match(hjul, /T\.uppläst\.slagPerMinutVärde/, 'värdet ska läsas i klartext');
});

test('varje tangent på klaviaturen har ett namn', () => {
  const klaviatur = läs('src/components/Keyboard.tsx');
  const antal = (klaviatur.match(/T\.uppläst\.tangent\(/g) ?? []).length;
  assert.equal(antal, 2, 'både vita och svarta tangenter ska ha etikett');
  assert.match(klaviatur, /accessibilityState=\{\{ selected: saved/);
});

test('flikarna säger vart de leder', () => {
  const skal = läs('App.tsx');
  assert.match(skal, /accessibilityRole="tab"/);
  for (const nyckel of ['flikSkapa', 'flikRedigera', 'flikLåtar', 'flikInställningar']) {
    assert.match(skal, new RegExp(`T\\.uppläst\\.${nyckel}`), `${nyckel} saknas`);
  }
});

test('brytarna bär sina radetiketter', () => {
  const inst = läs('src/screens/SettingsScreen.tsx');
  const switchar = (inst.match(/<Switch/g) ?? []).length;
  const märkta = (inst.match(/<Switch\n\s*accessibilityLabel/g) ?? []).length;
  assert.equal(märkta, switchar, `${switchar - märkta} brytare saknar etikett`);
});

test('taktvisarna är dolda dekor, inte namnlösa hinder', () => {
  for (const fil of ['src/components/MetronomeVisual.tsx', 'src/screens/SongsScreen.tsx']) {
    const källa = läs(fil);
    assert.match(källa, /accessibilityElementsHidden/, `${fil} exponerar dekor`);
  }
});
