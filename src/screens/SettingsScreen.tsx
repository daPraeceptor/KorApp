/** Inställningar: kammarton, tonnamn, volym och hur körtonerna ges. */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, SectionTitle, SegmentedControl, Stepper } from '../components/ui';
import { audioEngine } from '../audio/engine';
import { useAppState } from '../state/AppState';
import {
  DEFAULT_A4,
  INTERVAL_NAMES,
  JUST_RATIOS,
  centsBetween,
} from '../theory/tuning';
import { MAX_TONE_GAP_BPM, MIN_TONE_GAP_BPM } from '../store/songs';
import { colors, radius, spacing } from '../theme';

export function SettingsScreen() {
  const { settings, updateSettings } = useAppState();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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
        <SectionTitle>Tonnamn</SectionTitle>
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
      </Card>

      <Card>
        <SectionTitle>Körtoner</SectionTitle>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Standardhastighet</Text>
          <Stepper
            value={settings.defaultToneGapBpm}
            min={MIN_TONE_GAP_BPM}
            max={MAX_TONE_GAP_BPM}
            step={5}
            onChange={(defaultToneGapBpm) => updateSettings({ defaultToneGapBpm })}
            format={(value) => `${value} slag/min`}
          />
        </View>
        <Text style={styles.help}>
          Hastigheten när tonerna ges en i taget. Varje låt bär sitt eget värde —
          det här är vad en ny låt börjar med.
        </Text>

        <Text style={styles.rowLabel}>Ordning på tonerna</Text>
        <SegmentedControl
          value={settings.toneOrder}
          tint={colors.pure}
          onChange={(toneOrder) => updateSettings({ toneOrder })}
          options={[
            { value: 'pitch' as const, label: 'Efter tonhöjd' },
            { value: 'entry' as const, label: 'I vald ordning' },
          ]}
        />
        <Text style={styles.help}>
          {settings.toneOrder === 'pitch'
            ? 'Tonerna läggs i ordning efter tonhöjd, oavsett i vilken följd du väljer dem.'
            : 'Tonerna behåller den följd du väljer dem i, till exempel stämmornas insatsordning. Uppspelningen följer då den ordningen i stället för tonhöjd.'}
        </Text>
      </Card>

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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text,
    fontSize: 15,
  },
  help: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  table: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tableInterval: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  tableRatio: {
    width: 56,
    color: colors.pure,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  tableCents: {
    width: 62,
    color: colors.accent,
    fontSize: 13,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  tableCentsNeutral: {
    color: colors.textMuted,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
