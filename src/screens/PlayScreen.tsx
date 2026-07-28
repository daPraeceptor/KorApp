/**
 * Spelvyn: tempo, taktart, stämning och körens starttoner på en och samma skärm,
 * så att körledaren slipper byta vy mitt i en repetition.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Keyboard } from '../components/Keyboard';
import { MetronomeVisual } from '../components/MetronomeVisual';
import { NoteValueIcon } from '../components/NoteValueIcon';
import { TempoWheel } from '../components/TempoWheel';
import { Button, Card, SectionTitle, SegmentedControl, Stepper } from '../components/ui';
import { MAX_BPM, MIN_BPM, clampBpm, tempoFromTaps } from '../audio/tempo';
import { useAppState } from '../state/AppState';
import {
  centsFromTempered,
  frequencyOf,
  intervalName,
  noteLabel,
  noteName,
  noteNameWithOctave,
  ratioLabel,
} from '../theory/tuning';
import {
  MAX_TONES,
  MAX_TONE_GAP_BPM,
  MIN_TONE_GAP_BPM,
} from '../store/songs';
import { colors, radius, spacing } from '../theme';

/** Knackningar som ligger längre isär än så här räknas som ett nytt tempo. */
const TAP_RESET_MS = 2000;

const LOWEST_MIDI = 24;
const HIGHEST_START = 84;
const KEYBOARD_SPAN = 24;

export function PlayScreen({ onOpenSongs }: { onOpenSongs: () => void }) {
  const {
    live,
    settings,
    tuning,
    currentSong,
    hasUnsavedChanges,
    labels,
    metronomeRunning,
    activeBeat,
    pulse,
    toggleMetronome,
    playTones,
    updateLive,
    toggleSongTone,
    saveToCurrentSong,
  } = useAppState();

  const [selectMode, setSelectMode] = useState(false);
  const [playedNote, setPlayedNote] = useState<number | null>(null);
  const [keyboardStart, setKeyboardStart] = useState(48);
  const [wheelDragging, setWheelDragging] = useState(false);
  const taps = useRef<number[]>([]);

  const tapTempo = useCallback(() => {
    const now = Date.now();
    const previous = taps.current;
    const timestamps =
      previous.length > 0 && now - previous[previous.length - 1] > TAP_RESET_MS
        ? [now]
        : [...previous, now].slice(-6);
    taps.current = timestamps;

    const bpm = tempoFromTaps(timestamps);
    if (bpm !== null) {
      updateLive({ bpm });
    }
  }, [updateLive]);

  const displayedNote = playedNote;
  const noTones = live.tones.length === 0;
  const cents = displayedNote === null ? 0 : centsFromTempered(displayedNote, tuning);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      // Vyn får inte rulla iväg under fingret medan tempohjulet vrids.
      scrollEnabled={!wheelDragging}
    >
      <Pressable style={styles.songBar} onPress={onOpenSongs}>
        <View style={styles.songBarText}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {currentSong ? currentSong.title : 'Ingen låt vald'}
          </Text>
          <Text style={styles.songHint}>
            {currentSong ? 'Tryck för att byta låt' : 'Tryck för att välja eller skapa en låt'}
          </Text>
        </View>
        {hasUnsavedChanges ? (
          <Button
            label="Spara"
            variant="primary"
            onPress={saveToCurrentSong}
            style={styles.saveButton}
          />
        ) : null}
      </Pressable>

      <MetronomeVisual
        style={settings.metronomeVisual}
        running={metronomeRunning}
        bpm={live.bpm}
        pulse={pulse}
        activeBeat={activeBeat}
      />

      <View style={styles.wheelArea}>
        <TempoWheel
          bpm={live.bpm}
          onChange={(bpm) => updateLive({ bpm })}
          activeBeat={metronomeRunning ? activeBeat : null}
          beatsPerBar={live.beatsPerBar}
          onDraggingChange={setWheelDragging}
        />
      </View>

      <View style={styles.transport}>
        <Button
          label="−1"
          onPress={() => updateLive({ bpm: clampBpm(live.bpm - 1) })}
          style={styles.nudge}
        />
        <Button
          label={metronomeRunning ? 'Stoppa' : 'Starta'}
          variant={metronomeRunning ? 'default' : 'primary'}
          onPress={() => void toggleMetronome()}
          style={styles.transportMain}
        />
        <Button
          label="+1"
          onPress={() => updateLive({ bpm: clampBpm(live.bpm + 1) })}
          style={styles.nudge}
        />
      </View>

      <Button label="Knacka tempo" onPress={tapTempo} variant="ghost" />

      <Card>
        <SectionTitle>Takt</SectionTitle>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Slag per takt</Text>
          <Stepper
            value={live.beatsPerBar}
            min={1}
            max={12}
            onChange={(beatsPerBar) => updateLive({ beatsPerBar })}
          />
        </View>
        <Text style={styles.rowLabel}>Underdelning</Text>
        <SegmentedControl
          value={live.subdivision}
          onChange={(subdivision) => updateLive({ subdivision })}
          options={[
            {
              value: 1,
              label: 'Fjärdedelar',
              renderIcon: (color) => <NoteValueIcon value="quarter" color={color} />,
            },
            {
              value: 2,
              label: 'Åttondelar',
              renderIcon: (color) => <NoteValueIcon value="eighths" color={color} />,
            },
            {
              value: 3,
              label: 'Trioler',
              renderIcon: (color) => <NoteValueIcon value="triplet" color={color} />,
            },
            {
              value: 4,
              label: 'Sextondelar',
              renderIcon: (color) => (
                <NoteValueIcon value="sixteenths" color={color} />
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>Stämning</SectionTitle>
        <SegmentedControl
          value={live.tuningSystem}
          tint={live.tuningSystem === 'just' ? colors.pure : colors.accent}
          onChange={(tuningSystem) => updateLive({ tuningSystem })}
          options={[
            { value: 'tempered' as const, label: 'Tempererad' },
            { value: 'just' as const, label: 'Ren (svävningsfri)' },
          ]}
        />

        {live.tuningSystem === 'just' ? (
          <View style={styles.tonicBox}>
            <View>
              <Text style={styles.tonicLabel}>Tonika</Text>
              <Text style={styles.tonicValue}>
                {noteName(live.tonicPitchClass, settings.naming)}
              </Text>
            </View>
            <Text style={styles.tonicHint}>
              Dubbeltryck på en tangent för att välja referenston.
            </Text>
          </View>
        ) : (
          <Text style={styles.helpText}>
            Alla halvtoner lika stora, som ett piano. Byt till ren stämning för
            svävningsfria ackord.
          </Text>
        )}
      </Card>

      <Card>
        <View style={styles.row}>
          <SectionTitle>Tongivning</SectionTitle>
          <Text style={styles.counter}>
            {live.tones.length}/{MAX_TONES}
          </Text>
        </View>

        {live.tones.length === 0 ? (
          <Text style={styles.helpText}>
            Slå på «Välj toner» och tryck på klaviaturen för att spara de toner
            kören ska få.
          </Text>
        ) : (
          <View style={styles.chips}>
            {live.tones.map((midi) => (
              <Pressable
                key={midi}
                onPress={() => toggleSongTone(midi)}
                style={styles.chip}
              >
                <Text style={styles.chipText}>
                  {noteNameWithOctave(midi, settings.naming)}
                </Text>
                <Text style={styles.chipRemove}>×</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Button
          label="Spela ackordet"
          variant="pure"
          disabled={noTones}
          onPress={() => playTones('chord')}
        />
        <View style={styles.toneButtons}>
          <Button
            label="↑ Nedifrån och upp"
            disabled={noTones}
            onPress={() => playTones('up')}
            style={styles.toneButton}
          />
          <Button
            label="↓ Uppifrån och ner"
            disabled={noTones}
            onPress={() => playTones('down')}
            style={styles.toneButton}
          />
        </View>
        <Button
          label="⇢ I vald ordning"
          disabled={noTones}
          onPress={() => playTones('chosen')}
        />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Hastighet en i taget</Text>
          <Stepper
            value={live.toneGapBpm}
            min={MIN_TONE_GAP_BPM}
            max={MAX_TONE_GAP_BPM}
            step={5}
            onChange={(toneGapBpm) => updateLive({ toneGapBpm })}
            format={(value) => `${value} slag/min`}
          />
        </View>
        <Text style={styles.toneHint}>
          Hastigheten sparas med låten. Nya låtar börjar på{' '}
          {settings.defaultToneGapBpm} slag/min, vilket går att ändra i
          inställningarna.
        </Text>
      </Card>

      <Card style={styles.keyboardCard}>
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setSelectMode((current) => !current)}
            style={[styles.toggle, selectMode && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, selectMode && styles.toggleTextOn]}>
              Välj toner
            </Text>
          </Pressable>
        </View>

        <View style={styles.octaveRow}>
          <Button
            label="◀ Oktav"
            variant="ghost"
            disabled={keyboardStart <= LOWEST_MIDI}
            onPress={() => setKeyboardStart((start) => Math.max(LOWEST_MIDI, start - 12))}
          />
          <Text style={styles.octaveLabel}>
            {noteNameWithOctave(keyboardStart, settings.naming)} –{' '}
            {noteNameWithOctave(keyboardStart + KEYBOARD_SPAN, settings.naming)}
          </Text>
          <Button
            label="Oktav ▶"
            variant="ghost"
            disabled={keyboardStart >= HIGHEST_START}
            onPress={() => setKeyboardStart((start) => Math.min(HIGHEST_START, start + 12))}
          />
        </View>

        <Keyboard
          fromMidi={keyboardStart}
          toMidi={keyboardStart + KEYBOARD_SPAN}
          tuning={tuning}
          labels={labels}
          showLabels={settings.showNoteNames}
          selectedTones={live.tones}
          selectMode={selectMode}
          // Tonikan styr både den rena stämningen och solmisationen, så den
          // sätts utan att stämningssystemet ändras med.
          onSetTonic={(pitchClass) => updateLive({ tonicPitchClass: pitchClass })}
          onToggleTone={toggleSongTone}
          onNotePlayed={setPlayedNote}
        />

        <View style={styles.readout}>
          {displayedNote === null ? (
            <Text style={styles.readoutIdle}>
              Tryck på en tangent för att höra tonen. Dubbeltryck för att sätta
              tonika.
            </Text>
          ) : (
            <>
              <Text style={styles.readoutNote}>
                {noteNameWithOctave(displayedNote, settings.naming)}
                {settings.labelSystem !== 'letters'
                  ? `  ·  ${noteLabel(displayedNote, labels)}`
                  : ''}
              </Text>
              <Text style={styles.readoutDetail}>
                {frequencyOf(displayedNote, tuning).toFixed(2)} Hz
                {tuning.system === 'just'
                  ? ` · ${intervalName(displayedNote, tuning.tonicPitchClass)} ${ratioLabel(
                      displayedNote,
                      tuning.tonicPitchClass,
                    )}`
                  : ''}
              </Text>
              {tuning.system === 'just' ? (
                <Text
                  style={[
                    styles.readoutCents,
                    Math.abs(cents) < 0.05 && styles.readoutCentsNeutral,
                  ]}
                >
                  {cents >= 0 ? '+' : '−'}
                  {Math.abs(cents).toFixed(1)} cent mot tempererad
                </Text>
              ) : null}
            </>
          )}
        </View>
      </Card>

      <Text style={styles.rangeHint}>
        Tempoområde {MIN_BPM}–{MAX_BPM} slag per minut. Kammarton A = {settings.a4} Hz.
      </Text>
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
  songBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  songBarText: {
    flex: 1,
  },
  songTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  songHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  saveButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  wheelArea: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  transport: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  transportMain: {
    flex: 1,
    paddingVertical: 16,
  },
  nudge: {
    width: 64,
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
  helpText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  tonicBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.pure,
  },
  tonicLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tonicValue: {
    color: colors.pure,
    fontSize: 30,
    fontWeight: '800',
  },
  tonicHint: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  counter: {
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.tone,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  chipRemove: {
    color: colors.textMuted,
    fontSize: 15,
  },
  toneButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toneButton: {
    flex: 1,
  },
  toneHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  keyboardCard: {
    paddingHorizontal: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  toggle: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleOn: {
    backgroundColor: colors.tone,
    borderColor: colors.tone,
  },
  toggleText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextOn: {
    color: '#0c1630',
  },
  octaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  octaveLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  readout: {
    minHeight: 62,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  readoutIdle: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  readoutNote: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  readoutDetail: {
    color: colors.textMuted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  readoutCents: {
    color: colors.pure,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  readoutCentsNeutral: {
    color: colors.textMuted,
  },
  rangeHint: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
