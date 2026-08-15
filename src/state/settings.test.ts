import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_A4,
  MAX_AUTO_STOP_BEATS,
  MIN_A4,
  MIN_VOLUME,
  type Settings,
  normalizeSettings,
  parseSettings,
} from './settings.ts';

const FÖRVAL: Settings = {
  a4: 440,
  naming: 'international',
  volume: 0.8,
  defaultToneGapBpm: 80,
  showNoteNames: true,
  labelSystem: 'letters',
  labelReference: 'tonic',
  markTonicInTempered: false,
  toneTimbre: 'choir',
  themeId: 'konsertsal',
  showAdvancedSubdivisions: false,
  metronomeVisual: 'ball',
  startTab: 'auto',
  autoStopFromList: false,
  autoStopBeats: 16,
  accentFirstBeat: true,
  haptics: true,
  keepAwake: true,
  tonesFirst: false,
};

test('sparade inställningar läses tillbaka oförändrade', () => {
  const egna: Settings = {
    ...FÖRVAL,
    a4: 442,
    naming: 'swedish',
    volume: 0.35,
    labelSystem: 'solfege',
    themeId: 'pergament',
    toneTimbre: 'flute',
    metronomeVisual: 'pendulum',
    autoStopFromList: true,
    autoStopBeats: 32,
  };
  assert.deepEqual(parseSettings(JSON.stringify(egna), FÖRVAL), egna);
});

test('kammartonen hålls inom det spelbara', () => {
  // En kammarton på noll ger toner utan frekvens, och sådana går inte att
  // spela. Orimliga värden blir 440 igen, inte spannets kant: en kör ska
  // inte tyst hamna i barockstämning för att lagringen tagit skada.
  for (const [sparat, väntat] of [
    [0, FÖRVAL.a4],
    [-440, FÖRVAL.a4],
    [1e308, FÖRVAL.a4],
    [900, FÖRVAL.a4],
    [200, FÖRVAL.a4],
    [MIN_A4, MIN_A4],
    [MAX_A4, MAX_A4],
    [442, 442],
  ] as [unknown, number][]) {
    assert.equal(normalizeSettings({ a4: sparat }, FÖRVAL).a4, väntat, `a4 ${String(sparat)}`);
  }
  for (const trasigt of [NaN, Infinity, null, '442', {}, undefined]) {
    assert.equal(normalizeSettings({ a4: trasigt }, FÖRVAL).a4, FÖRVAL.a4);
  }
});

test('okända val faller tillbaka på det man hade', () => {
  const s = normalizeSettings(
    {
      themeId: 'finns-inte',
      toneTimbre: 'dragspel',
      labelSystem: 'hieroglyfer',
      metronomeVisual: 42,
      startTab: null,
      naming: 'klingon',
    },
    FÖRVAL,
  );
  assert.equal(s.themeId, FÖRVAL.themeId);
  assert.equal(s.toneTimbre, FÖRVAL.toneTimbre);
  assert.equal(s.labelSystem, FÖRVAL.labelSystem);
  assert.equal(s.metronomeVisual, FÖRVAL.metronomeVisual);
  assert.equal(s.startTab, FÖRVAL.startTab);
  assert.equal(s.naming, FÖRVAL.naming);
});

test('ett trasigt fält kostar bara sitt eget värde', () => {
  const s = normalizeSettings({ a4: 'trasigt', themeId: 'notblad', haptics: false }, FÖRVAL);
  assert.equal(s.a4, FÖRVAL.a4, 'det trasiga fältet faller tillbaka');
  assert.equal(s.themeId, 'notblad', 'de hela fälten följer med');
  assert.equal(s.haptics, false);
});

test('ljudstyrkan hamnar aldrig utanför sitt spann', () => {
  assert.equal(normalizeSettings({ volume: 99 }, FÖRVAL).volume, 1);
  assert.equal(normalizeSettings({ volume: -1 }, FÖRVAL).volume, MIN_VOLUME);
  assert.equal(normalizeSettings({ volume: 0 }, FÖRVAL).volume, MIN_VOLUME);
});

test('automatstoppet kan inte ställas på noll slag', () => {
  // Noll eller negativt skulle stoppa metronomen vid första klicket.
  assert.ok(normalizeSettings({ autoStopBeats: 0 }, FÖRVAL).autoStopBeats >= 2);
  assert.ok(normalizeSettings({ autoStopBeats: -5 }, FÖRVAL).autoStopBeats >= 2);
  assert.equal(normalizeSettings({ autoStopBeats: 1e9 }, FÖRVAL).autoStopBeats, MAX_AUTO_STOP_BEATS);
});

test('trasig lagring ger de inställningar man redan hade', () => {
  for (const json of [null, '', 'inte json', '[]', 'null', '42', '"text"']) {
    assert.deepEqual(parseSettings(json, FÖRVAL), FÖRVAL, `lagring ${JSON.stringify(json)}`);
  }
});

test('okända fält från en nyare version skräpar inte ner', () => {
  const s = normalizeSettings({ framtidaFält: 'något', a4: 442 }, FÖRVAL);
  assert.equal((s as unknown as Record<string, unknown>).framtidaFält, undefined);
  assert.equal(s.a4, 442);
});
