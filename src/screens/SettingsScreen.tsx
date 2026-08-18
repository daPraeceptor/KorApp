/** Inställningar: kammarton, tonnamn, volym och hur körtonerna ges. */
import React, { useState } from 'react';
import {
  Linking,
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
import { T } from '../i18n';
import {
  MAX_AUTO_STOP_BEATS,
  MIN_AUTO_STOP_BEATS,
  useAppState,
} from '../state/AppState';
import {
  DEFAULT_A4,
  JUST_RATIOS,
  centsBetween,
} from '../theory/tuning';
import { MAX_TONE_GAP_BPM, MIN_TONE_GAP_BPM } from '../store/songs';
import { TIMBRES, TIMBRE_ORDER, timbreOr } from '../audio/timbres';
import { SUBDIVISIONS, SUBDIVISION_ORDER } from '../audio/subdivisions';
import {
  Palette,
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
        <SectionTitle>{T.inst.volym}</SectionTitle>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{T.inst.ljudstyrka}</Text>
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
          label={T.inst.testaLjudet}
          onPress={() =>
            void audioEngine.playTones([261.63, 329.63, 392], {
              mode: 'together',
              chordDuration: 1.6,
            })
          }
        />
      </Card>

      <Card>
        <SectionTitle>{T.inst.kammarton}</SectionTitle>
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
        <Text style={styles.help}>{T.inst.kammartonText}</Text>
        {settings.a4 !== DEFAULT_A4 ? (
          <Button
            label={T.inst.återställ440}
            variant="ghost"
            onPress={() => updateSettings({ a4: DEFAULT_A4 })}
          />
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{T.inst.färgtema}</SectionTitle>
        <View style={styles.themeGrid}>
          {THEME_ORDER.map((id) => {
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
                  {T.tema[id].namn}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.help}>{T.tema[settings.themeId].text}</Text>
      </Card>

      {/* Metronomens eget uppförande, samlat: hur den låter och vad den gör
          med telefonen medan den går. */}
      <Card>
        <SectionTitle>{T.inst.metronom}</SectionTitle>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{T.inst.betonaEttan}</Text>
          <Switch
            value={settings.accentFirstBeat}
            onValueChange={(accentFirstBeat) =>
              updateSettings({ accentFirstBeat })
            }
            trackColor={{ false: t.border, true: t.accent }}
            thumbColor={t.text}
          />
        </View>
        <Text style={styles.help}>{T.inst.betonaEttanText}</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{T.inst.hållSkärmenTänd}</Text>
          <Switch
            value={settings.keepAwake}
            onValueChange={(keepAwake) => updateSettings({ keepAwake })}
            trackColor={{ false: t.border, true: t.accent }}
            thumbColor={t.text}
          />
        </View>
        <Text style={styles.help}>{T.inst.hållSkärmenTändText}</Text>
      </Card>


      <Card>
        <SectionTitle>{T.inst.känsel}</SectionTitle>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{T.inst.vibration}</Text>
          <Switch
            value={settings.haptics}
            onValueChange={(haptics) => updateSettings({ haptics })}
            trackColor={{ false: t.border, true: t.accent }}
            thumbColor={t.text}
          />
        </View>
        <Text style={styles.help}>{T.inst.vibrationText}</Text>
      </Card>

      <Card>
        <SectionTitle>{T.inst.redigeringsvyn}</SectionTitle>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{T.inst.tongivningFörst}</Text>
          <Switch
            value={settings.tonesFirst}
            onValueChange={(tonesFirst) => updateSettings({ tonesFirst })}
            trackColor={{ false: t.border, true: t.accent }}
            thumbColor={t.text}
          />
        </View>
        <Text style={styles.help}>{T.inst.tongivningFörstText}</Text>
      </Card>

      <Card>
        <SectionTitle>{T.inst.startvy}</SectionTitle>
        <SegmentedControl
          value={settings.startTab}
          onChange={(startTab) => updateSettings({ startTab })}
          options={(['auto', 'play', 'songs'] as const).map((value) => ({
            value,
            label: T.inst.startvyVal[value],
          }))}
        />
        <Text style={styles.help}>{T.inst.startvyText}</Text>
      </Card>

      <Card>
        <SectionTitle>{T.inst.tempoFrånListan}</SectionTitle>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{T.inst.stoppaSjälv}</Text>
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
            <Text style={styles.rowLabel}>{T.inst.efter}</Text>
            <Stepper
              value={settings.autoStopBeats}
              min={MIN_AUTO_STOP_BEATS}
              max={MAX_AUTO_STOP_BEATS}
              step={2}
              onChange={(autoStopBeats) => updateSettings({ autoStopBeats })}
              format={(value) => T.inst.antalSlag(value)}
            />
          </View>
        ) : null}
        <Text style={styles.help}>
          {T.inst.autoStopText(
            settings.autoStopFromList ? String(settings.autoStopBeats) : T.inst.ettAntal,
          )}
        </Text>
      </Card>

      <Card>
        <View style={styles.row}>
          <SectionTitle>{T.inst.tonnamn}</SectionTitle>
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
              {settings.showNoteNames ? T.inst.visas : T.inst.dolda}
            </Text>
          </Pressable>
        </View>

        <SegmentedControl
          value={settings.labelSystem}
          onChange={(labelSystem) => updateSettings({ labelSystem })}
          options={[
            { value: 'letters' as const, label: T.inst.bokstäver },
            { value: 'solfege' as const, label: T.inst.doReMi },
            { value: 'degrees' as const, label: T.inst.tonplatser },
          ]}
        />

        {settings.labelSystem === 'letters' ? (
          <>
            <Text style={styles.rowLabel}>{T.inst.bokstavssystem}</Text>
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
                ? T.inst.internationellText
                : T.inst.svenskText}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.rowLabel}>{T.inst.räknasFrån}</Text>
            <SegmentedControl
              value={settings.labelReference}
              tint={t.pure}
              onChange={(labelReference) => updateSettings({ labelReference })}
              options={[
                { value: 'tonic' as const, label: T.inst.grundtonen },
                { value: 'c' as const, label: 'C' },
              ]}
            />
            <Text style={styles.help}>
              {settings.labelReference === 'tonic'
                ? T.inst.flyttbartText(settings.labelSystem === 'solfege' ? 'do' : 'I')
                : T.inst.fastText(settings.labelSystem === 'solfege' ? 'do' : 'I')}
            </Text>
            {settings.labelSystem === 'solfege' ? (
              <Text style={styles.footnote}>{T.inst.solfegeFotnot}</Text>
            ) : null}
          </>
        )}

        <Text style={styles.rowLabel}>{T.inst.markeraGrundton}</Text>
        <SegmentedControl
          value={settings.markTonicInTempered ? 'always' : 'just'}
          tint={t.pure}
          onChange={(val) => updateSettings({ markTonicInTempered: val === 'always' })}
          options={[
            { value: 'just' as const, label: T.inst.baraIRen },
            { value: 'always' as const, label: T.inst.alltid },
          ]}
        />
        <Text style={styles.help}>
          {settings.markTonicInTempered
            ? T.inst.grundtonAlltidText
            : T.inst.grundtonRenText}
        </Text>
      </Card>

      <Card>
        <View style={styles.row}>
          <SectionTitle>{T.inst.avanceradeUnderdelningar}</SectionTitle>
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
              {settings.showAdvancedSubdivisions ? T.inst.visas : T.inst.dolda}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.help}>{T.inst.avanceradeText}</Text>
        {SUBDIVISION_ORDER.filter((id) => SUBDIVISIONS[id].advanced).map((id) => (
          <Text key={id} style={styles.footnote}>
            <Text style={styles.rowLabel}>{T.underdelning[id].namn}</Text>
            {'  '}
            {T.underdelning[id].text}
          </Text>
        ))}
      </Card>

      <Card>
        <SectionTitle>{T.inst.taktvisare}</SectionTitle>
        <SegmentedControl
          value={settings.metronomeVisual}
          onChange={(metronomeVisual) => updateSettings({ metronomeVisual })}
          options={(['pendulum', 'bar', 'ball', 'none'] as const).map((value) => ({
            value,
            label: T.inst.taktvisareVal[value],
          }))}
        />
        <Text style={styles.help}>
          {T.inst.taktvisareText[settings.metronomeVisual]}
        </Text>
      </Card>

      <Card>
        <SectionTitle>{T.spel.tongivning}</SectionTitle>

        <Text style={styles.rowLabel}>{T.inst.klangfärg}</Text>
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
                  {T.klang[id].namn}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.help}>
          {T.klang[timbreOr(settings.toneTimbre).id].text} {T.inst.tryckFörAttHöra}
        </Text>

        <Button label={T.spel.tongivning} variant="pure" onPress={testToneGap} />

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{T.inst.tempoPåTongivning}</Text>
          <Text style={styles.rowValue}>
            {T.inst.slagPerMin(settings.defaultToneGapBpm)}
          </Text>
        </View>
        <Slider
          value={settings.defaultToneGapBpm}
          min={MIN_TONE_GAP_BPM}
          max={MAX_TONE_GAP_BPM}
          step={1}
          onChange={(defaultToneGapBpm) => updateSettings({ defaultToneGapBpm })}
        />
        <Text style={styles.help}>{T.inst.tongivningText}</Text>
        <Text style={styles.footnote}>{T.inst.tonordningFotnot}</Text>
      </Card>

      <Card>
        <SectionTitle>{T.inst.renaIntervall}</SectionTitle>
        <Text style={styles.help}>{T.inst.renaIntervallText}</Text>
        <View style={styles.table}>
          {JUST_RATIOS.map(([numerator, denominator], step) => {
            const cents = centsBetween(
              Math.pow(2, step / 12),
              numerator / denominator,
            );
            return (
              <View key={step} style={styles.tableRow}>
                <Text style={styles.tableInterval}>{T.intervall[step]}</Text>
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
        <Text style={styles.footnote}>{T.inst.centFotnot}</Text>
      </Card>

      {/*
        * Tacket är inte artighet utan villkor: flygelns prov är licensierade
        * under CC BY, som kräver att upphovsmannen namnges, att licensen
        * anges, och att det framgår att materialet är bearbetat. Alla tre
        * står här. Tas det bort får appen inte längre använda ljudet.
        */}
      <Card>
        <SectionTitle>{T.inst.tack}</SectionTitle>
        <Text style={styles.help}>{T.inst.tackText}</Text>
        <Text style={styles.footnote}>{T.inst.tackFotnot}</Text>
        <Pressable
          onPress={() => {
            // Öppnar i webbläsaren. Misslyckas det är det inget att göra åt,
            // och en trasig länk ska inte fälla inställningsvyn.
            void Linking.openURL(
              'https://creativecommons.org/licenses/by/3.0/',
            ).catch(() => {});
          }}
          hitSlop={8}
        >
          <Text style={styles.link}>creativecommons.org/licenses/by/3.0</Text>
        </Pressable>
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
  link: {
    color: t.tone,
    fontSize: 13,
    textDecorationLine: 'underline',
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
