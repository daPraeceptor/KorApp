/** Inställningar: kammarton, tonnamn, volym och hur körtonerna ges. */
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  Button,
  Card,
  SectionTitle,
  SegmentedControl,
  Slider,
  Stepper,
} from '../components/ui';
import { audioEngine } from '../audio/engine';
import {
  MAX_AUTO_STOP_BEATS,
  MIN_AUTO_STOP_BEATS,
  useAppState,
} from '../state/AppState';
import {
  DEFAULT_A4,
  INTERVAL_NAMES,
  JUST_RATIOS,
  centsBetween,
} from '../theory/tuning';
import { MAX_TONE_GAP_BPM, MIN_TONE_GAP_BPM } from '../store/songs';
import { TIMBRES, TIMBRE_ORDER, timbreOr } from '../audio/timbres';
import { SUBDIVISIONS, SUBDIVISION_ORDER } from '../audio/subdivisions';
import {
  Palette,
  THEME_META,
  THEME_ORDER,
  buildPalette,
  radius,
  spacing,
} from '../theme';
import { useTheme, useThemedStyles } from '../ThemeContext';

/** C-dur över en oktav: C4 i basen, E4, G4 och C5 överst. */
const TEST_CHORD = [60, 64, 67, 72];

export function SettingsScreen() {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { settings, updateSettings, live, playTones } = useAppState();
  // Diagnostikloggen bor utanför React; räknaren tvingar fram omritningen.

  /**
   * Provar tempot på riktiga toner. Med låtens egna toner hör man det man
   * faktiskt ska ge kören; utan valda toner får man ett C-durackord med C både
   * i basen och överst, så att hela spannet hörs.
   */
  const testToneGap = () => {
    if (live.tones.length > 0) {
      playTones('down');
      return;
    }
    playTones('down', {
      tones: TEST_CHORD,
      tuningSystem: 'tempered',
      tonicPitchClass: 0,
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Volymen överst: det är den inställning som ändras oftast, mitt i
          repetitionen, och skall inte behöva letas fram. */}
      <Card>
        <SectionTitle>Volym</SectionTitle>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Ljudstyrka</Text>
          <Stepper
            value={Math.round(settings.volume * 100)}
            min={10}
            max={100}
            step={10}
            onChange={(percent) => updateSettings({ volume: percent / 100 })}
            format={(value) => `${value} %`}
          />
        </View>
        <Button
          label="Testa ljudet"
          onPress={() =>
            void audioEngine.playTones([261.63, 329.63, 392], {
              mode: 'together',
              chordDuration: 1.6,
            })
          }
        />
      </Card>

      <Card>
        <SectionTitle>Kammarton</SectionTitle>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>A =</Text>
          <Stepper
            value={settings.a4}
            min={415}
            max={466}
            onChange={(a4) => updateSettings({ a4 })}
            format={(value) => `${value} Hz`}
          />
        </View>
        <Text style={styles.help}>
          Standard är 440 Hz. Många orglar och blåsorkestrar ligger på 442 Hz,
          och barockensembler ofta på 415 Hz.
        </Text>
        {settings.a4 !== DEFAULT_A4 ? (
          <Button
            label="Återställ till 440 Hz"
            variant="ghost"
            onPress={() => updateSettings({ a4: DEFAULT_A4 })}
          />
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Färgtema</SectionTitle>
        <View style={styles.themeGrid}>
          {THEME_ORDER.map((id) => {
            const meta = THEME_META[id];
            const vald = settings.themeId === id;
            // Färgprovet byggs ur temats egen palett, så knappen visar vad man får.
            const p = buildPalette(id);
            return (
              <Pressable
                key={id}
                onPress={() => updateSettings({ themeId: id })}
                style={[styles.themeChip, vald && styles.themeChipOn]}
              >
                <View style={[styles.themeSwatch, { backgroundColor: p.background }]}>
                  <View style={[styles.themeDot, { backgroundColor: p.accent }]} />
                  <View style={[styles.themeDot, { backgroundColor: p.pure }]} />
                  <View style={[styles.themeDot, { backgroundColor: p.tone }]} />
                </View>
                <Text style={[styles.themeName, vald && styles.themeNameOn]}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.help}>
          {THEME_META[settings.themeId].description}
        </Text>
      </Card>

      <Card>
        <SectionTitle>Startvy</SectionTitle>
        <SegmentedControl
          value={settings.startTab}
          onChange={(startTab) => updateSettings({ startTab })}
          options={[
            { value: 'auto' as const, label: 'Automatisk' },
            { value: 'play' as const, label: '+' },
            { value: 'songs' as const, label: 'Låtlistan' },
          ]}
        />
        <Text style={styles.help}>
          Automatisk öppnar låtlistan när det finns sparade låtar, annars
          skapandet.
        </Text>
      </Card>

      <Card>
        <SectionTitle>Tempo från låtlistan</SectionTitle>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Stoppa av sig själv</Text>
          <Switch
            value={settings.autoStopFromList}
            onValueChange={(autoStopFromList) =>
              updateSettings({ autoStopFromList })
            }
            trackColor={{ false: t.border, true: t.accent }}
            thumbColor={t.text}
          />
        </View>
        {settings.autoStopFromList ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Efter</Text>
            <Stepper
              value={settings.autoStopBeats}
              min={MIN_AUTO_STOP_BEATS}
              max={MAX_AUTO_STOP_BEATS}
              step={2}
              onChange={(autoStopBeats) => updateSettings({ autoStopBeats })}
              format={(value) => `${value} slag`}
            />
          </View>
        ) : null}
        <Text style={styles.help}>
          Tempoknappen i låtlistan stoppar metronomen av sig själv efter
          {settings.autoStopFromList ? ` ${settings.autoStopBeats}` : ' ett antal'}{' '}
          slag — varje hörbart klick räknas, underdelningar med. Gäller bara
          starter från listan — i spelvyn går metronomen tills du stoppar den.
        </Text>
      </Card>

      <Card>
        <View style={styles.row}>
          <SectionTitle>Tonnamn på tangenterna</SectionTitle>
          <Pressable
            onPress={() => updateSettings({ showNoteNames: !settings.showNoteNames })}
            style={[styles.toggle, settings.showNoteNames && styles.toggleOn]}
          >
            <Text
              style={[
                styles.toggleText,
                settings.showNoteNames && styles.toggleTextOn,
              ]}
            >
              {settings.showNoteNames ? 'Visas' : 'Dolda'}
            </Text>
          </Pressable>
        </View>

        <SegmentedControl
          value={settings.labelSystem}
          onChange={(labelSystem) => updateSettings({ labelSystem })}
          options={[
            { value: 'letters' as const, label: 'Bokstäver' },
            { value: 'solfege' as const, label: 'Do re mi' },
            { value: 'degrees' as const, label: 'Tonplatser' },
          ]}
        />

        {settings.labelSystem === 'letters' ? (
          <>
            <Text style={styles.rowLabel}>Bokstavssystem</Text>
            <SegmentedControl
              value={settings.naming}
              onChange={(naming) => updateSettings({ naming })}
              options={[
                { value: 'international' as const, label: 'B' },
                { value: 'swedish' as const, label: 'H' },
              ]}
            />
            <Text style={styles.help}>
              {settings.naming === 'international'
                ? 'Internationell notation: tonen över A heter B, och tonen ett halvt steg under heter B♭.'
                : 'Svensk notation: tonen över A heter H, och tonen ett halvt steg under heter B.'}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.rowLabel}>Räknas från</Text>
            <SegmentedControl
              value={settings.labelReference}
              tint={t.pure}
              onChange={(labelReference) => updateSettings({ labelReference })}
              options={[
                { value: 'tonic' as const, label: 'Grundtonen' },
                { value: 'c' as const, label: 'C' },
              ]}
            />
            <Text style={styles.help}>
              {settings.labelReference === 'tonic'
                ? `Flyttbart: grundtonen blir alltid ${
                    settings.labelSystem === 'solfege' ? 'do' : 'I'
                  }, så samma benämning betyder samma funktion oavsett tonart. Grundtonen väljs med dubbeltryck på klaviaturen.`
                : `Fast: C är alltid ${
                    settings.labelSystem === 'solfege' ? 'do' : 'I'
                  }, oavsett vilken tonart stycket går i.`}
            </Text>
            {settings.labelSystem === 'solfege' ? (
              <Text style={styles.footnote}>
                Halvtonerna stavas sänkta — ra, me, le, te — utom den höjda
                kvarten fi. En kör möter till exempel F i G-dur som sänkt septim,
                inte som höjd sext.
              </Text>
            ) : null}
          </>
        )}

        <Text style={styles.rowLabel}>Markera grundtonstangenten</Text>
        <SegmentedControl
          value={settings.markTonicInTempered ? 'always' : 'just'}
          tint={t.pure}
          onChange={(val) => updateSettings({ markTonicInTempered: val === 'always' })}
          options={[
            { value: 'just' as const, label: 'Bara i ren stämning' },
            { value: 'always' as const, label: 'Alltid' },
          ]}
        />
        <Text style={styles.help}>
          {settings.markTonicInTempered
            ? 'Grundtonen märks ut med etikett och färg i båda stämningarna.'
            : 'Grundtonen märks bara ut i ren stämning, där allt annat stäms mot den. I tempererad stämning har den ingen hörbar följd.'}
        </Text>
      </Card>

      <Card>
        <View style={styles.row}>
          <SectionTitle>Avancerade underdelningar</SectionTitle>
          <Pressable
            onPress={() =>
              updateSettings({
                showAdvancedSubdivisions: !settings.showAdvancedSubdivisions,
              })
            }
            style={[styles.toggle, settings.showAdvancedSubdivisions && styles.toggleOn]}
          >
            <Text
              style={[
                styles.toggleText,
                settings.showAdvancedSubdivisions && styles.toggleTextOn,
              ]}
            >
              {settings.showAdvancedSubdivisions ? 'Visas' : 'Dolda'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.help}>
          Lägger till swing, punkterat och kvintol bland underdelningarna i
          spelvyn. Till skillnad från de vanliga är de ojämnt fördelade över
          taktslaget.
        </Text>
        {SUBDIVISION_ORDER.filter((id) => SUBDIVISIONS[id].advanced).map((id) => (
          <Text key={id} style={styles.footnote}>
            <Text style={styles.rowLabel}>{SUBDIVISIONS[id].label}</Text>
            {'  '}
            {SUBDIVISIONS[id].description}
          </Text>
        ))}
      </Card>

      <Card>
        <SectionTitle>Taktvisare</SectionTitle>
        <SegmentedControl
          value={settings.metronomeVisual}
          onChange={(metronomeVisual) => updateSettings({ metronomeVisual })}
          options={[
            { value: 'pendulum' as const, label: 'Pendel' },
            { value: 'bar' as const, label: 'Streck' },
            { value: 'ball' as const, label: 'Boll' },
            { value: 'none' as const, label: 'Ingen' },
          ]}
        />
        <Text style={styles.help}>
          {settings.metronomeVisual === 'pendulum'
            ? 'En klassisk pendel som vänder på varje taktslag.'
            : settings.metronomeVisual === 'bar'
              ? 'Ett streck som går fram och tillbaka och vänder på varje taktslag.'
              : settings.metronomeVisual === 'ball'
                ? 'En boll som studsar mot marken på varje taktslag. Studsen blir högre vid långsamma tempon och lägre vid snabba.'
                : 'Ingen grafisk taktvisare. Taktdelarna syns ändå som prickar i tempohjulet.'}
        </Text>
      </Card>

      <Card>
        <SectionTitle>Tongivning</SectionTitle>

        <Text style={styles.rowLabel}>Klangfärg</Text>
        <View style={styles.timbreGrid}>
          {TIMBRE_ORDER.map((id) => {
            const vald = settings.toneTimbre === id;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  updateSettings({ toneTimbre: id });
                  // Byt klang först, så att provtonen låter som valet.
                  audioEngine.setTimbre(id);
                  void audioEngine.playTones([261.63, 329.63, 392], {
                    mode: 'together',
                    chordDuration: 1.4,
                  });
                }}
                style={[styles.timbreChip, vald && styles.timbreChipOn]}
              >
                <Text
                  style={[styles.timbreChipText, vald && styles.timbreChipTextOn]}
                >
                  {TIMBRES[id].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.help}>
          {timbreOr(settings.toneTimbre).description} Tryck på en klang för att
          höra den.
        </Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Tempo mellan tonerna</Text>
          <Text style={styles.rowValue}>
            {settings.defaultToneGapBpm} slag/min
          </Text>
        </View>
        <Slider
          value={settings.defaultToneGapBpm}
          min={MIN_TONE_GAP_BPM}
          max={MAX_TONE_GAP_BPM}
          step={1}
          onChange={(defaultToneGapBpm) => updateSettings({ defaultToneGapBpm })}
        />
        <Button label="Testa tempot" variant="pure" onPress={testToneGap} />
        <Text style={styles.help}>
          Tempot mellan tonerna när de ges en i taget. Gäller alla låtar.
          Testknappen spelar spelvyns toner, eller ett C-durackord uppifrån och
          ner om inga är valda.
        </Text>
        <Text style={styles.footnote}>
          Tonerna sparas alltid i den ordning du väljer dem. Knapparna i spelvyn
          avgör om de ges nedifrån och upp, uppifrån och ner, eller i den valda
          ordningen.
        </Text>
      </Card>

      <Card>
        <SectionTitle>Rena intervall</SectionTitle>
        <Text style={styles.help}>
          I ren stämning byggs varje intervall av en enkel frekvenskvot, vilket
          gör att övertonerna sammanfaller och svävningarna försvinner. Så här
          mycket skiljer sig tonerna från ett piano:
        </Text>
        <View style={styles.table}>
          {JUST_RATIOS.map(([numerator, denominator], step) => {
            const cents = centsBetween(
              Math.pow(2, step / 12),
              numerator / denominator,
            );
            return (
              <View key={step} style={styles.tableRow}>
                <Text style={styles.tableInterval}>{INTERVAL_NAMES[step]}</Text>
                <Text style={styles.tableRatio}>
                  {numerator}/{denominator}
                </Text>
                <Text
                  style={[
                    styles.tableCents,
                    Math.abs(cents) < 0.5 && styles.tableCentsNeutral,
                  ]}
                >
                  {cents >= 0 ? '+' : '−'}
                  {Math.abs(cents).toFixed(1)}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.footnote}>
          Avvikelse i cent, där 100 cent är en halvton på pianot.
        </Text>
      </Card>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowLabel: {
    color: t.text,
    fontSize: 15,
  },
  rowValue: {
    color: t.text,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  help: {
    color: t.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  table: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.border,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
  },
  tableInterval: {
    flex: 1,
    color: t.text,
    fontSize: 13,
  },
  tableRatio: {
    width: 56,
    color: t.pure,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  tableCents: {
    width: 62,
    color: t.accent,
    fontSize: 13,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  tableCentsNeutral: {
    color: t.textMuted,
  },
  footnote: {
    color: t.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  themeChip: {
    alignItems: 'center',
    gap: 5,
    padding: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceRaised,
  },
  themeChipOn: {
    borderColor: t.accent,
    backgroundColor: t.surface,
  },
  themeSwatch: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
    width: 62,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.border,
  },
  themeDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  themeName: {
    color: t.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  themeNameOn: {
    color: t.text,
  },
  timbreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  timbreChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceRaised,
  },
  timbreChipOn: {
    backgroundColor: t.pure,
    borderColor: t.pure,
  },
  timbreChipText: {
    color: t.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  timbreChipTextOn: {
    color: t.onTone,
  },
  toggle: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
  },
  toggleOn: {
    backgroundColor: t.tone,
    borderColor: t.tone,
  },
  toggleText: {
    color: t.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextOn: {
    color: t.onTone,
  },
});
