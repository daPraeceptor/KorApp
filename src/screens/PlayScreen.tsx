/**
 * Spelvyn: tempo, taktart, stämning och körens starttoner på en och samma skärm,
 * så att körledaren slipper byta vy mitt i en repetition.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Keyboard } from '../components/Keyboard';
import { MetronomeVisual } from '../components/MetronomeVisual';
import { NoteValueIcon } from '../components/NoteValueIcon';
import {
  SUBDIVISIONS,
  SUBDIVISION_ORDER,
  subdivisionOr,
} from '../audio/subdivisions';
import { TempoWheel } from '../components/TempoWheel';
import { Button, Card, SectionTitle, SegmentedControl, Stepper } from '../components/ui';
import { MAX_BPM, MIN_BPM, clampBpm, tempoFromTaps } from '../audio/tempo';
import { useAppState } from '../state/AppState';
import {
  centsFromTempered,
  frequencyOf,
  intervalName,
  noteLabel,
  noteNameWithOctave,
  ratioLabel,
} from '../theory/tuning';
import {
  MAX_TONES,
  MAX_TONE_GAP_BPM,
  MIN_TONE_GAP_BPM,
} from '../store/songs';
import { Palette, radius, spacing } from '../theme';
import { useTheme, useThemedStyles } from '../ThemeContext';

/** Knackningar som ligger längre isär än så här räknas som ett nytt tempo. */
const TAP_RESET_MS = 2000;

const LOWEST_MIDI = 24;
const HIGHEST_START = 84;
const KEYBOARD_SPAN = 24;

export function PlayScreen({ onOpenSongs }: { onOpenSongs: () => void }) {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  const [meterOpen, setMeterOpen] = useState(true);
  const [tonesOpen, setTonesOpen] = useState(true);
  const taps = useRef<number[]>([]);
  const föregåendeAntalToner = useRef(live.tones.length);

  /**
   * Tonvalet öppnar kortet hopfällt med en instruktion, så att klaviaturen
   * hamnar i blickfånget i stället för en tom knapprad. Första tonen fäller
   * upp det igen — då finns det något att se.
   */
  const toggleSelectMode = useCallback(() => {
    if (!selectMode && live.tones.length === 0) {
      setTonesOpen(false);
    }
    setSelectMode((current) => !current);
  }, [selectMode, live.tones.length]);

  useEffect(() => {
    if (live.tones.length > 0 && föregåendeAntalToner.current === 0) {
      setTonesOpen(true);
    }
    föregåendeAntalToner.current = live.tones.length;
  }, [live.tones.length]);

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
  // De avancerade göms tills körledaren slår på dem, men en redan vald
  // underdelning måste synas även då — annars ser knappraden tom ut.
  const synligaUnderdelningar = SUBDIVISION_ORDER.filter(
    (id) =>
      !SUBDIVISIONS[id].advanced ||
      settings.showAdvancedSubdivisions ||
      live.subdivision === id,
  );

  const toneCount = live.tones.length;
  // Tonikan går bara att sätta där den betyder något, så tipset följer
  // markeringen i stället för att stå kvar och lova något som inte händer.
  const markTonic = live.tuningSystem === 'just' || settings.markTonicInTempered;
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
        <Button
          label="Knacka"
          onPress={tapTempo}
          variant="ghost"
          style={styles.tapButton}
        />
      </View>

      <Card>
        <Pressable
          onPress={() => setMeterOpen((open) => !open)}
          style={styles.cardHeader}
        >
          <SectionTitle>Taktart</SectionTitle>
          <Text style={styles.cardHeaderNote}>
            {/* Hopfälld visar kortet ändå vad som är inställt. */}
            {meterOpen
              ? '▾'
              : `${live.beatsPerBar}/4 · ${subdivisionOr(live.subdivision).label.toLocaleLowerCase('sv')}  ▸`}
          </Text>
        </Pressable>

        {meterOpen ? (
          <>
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
              options={synligaUnderdelningar.map((id) => ({
                value: id,
                // Med alla åtta framme finns ingen plats för text. Notbilderna
                // säger ändå vad varje figur är, och namnen står i inställningarna.
                label: settings.showAdvancedSubdivisions ? '' : SUBDIVISIONS[id].label,
                renderIcon: (color: string) => (
                  <NoteValueIcon value={id} color={color} />
                ),
              }))}
            />
          </>
        ) : null}
      </Card>

      {/* Utan sparade toner finns ingenting att ge kören. Kortet väcks ändå
          så fort man slår på tonvalet, så att man ser var tonerna hamnar. */}
      {toneCount > 0 || selectMode ? (
        <Card>
          <Pressable
            onPress={() => setTonesOpen((open) => !open)}
            style={styles.cardHeader}
          >
            <SectionTitle>Tongivning</SectionTitle>
            <Text style={styles.cardHeaderNote}>
              {/* Hopfälld visar kortet ändå vilka toner som ligger sparade. */}
              {tonesOpen
                ? `${toneCount}/${MAX_TONES}  ▾`
                : toneCount === 0
                  ? '▸'
                  : `${live.tones
                      .map((midi) => noteNameWithOctave(midi, settings.naming))
                      .join(' ')}  ▸`}
            </Text>
          </Pressable>

          {!tonesOpen && toneCount === 0 ? (
            <Text style={styles.helpText}>
              Tryck på en tangent på klaviaturen för att lägga till en ton.
            </Text>
          ) : null}

          {tonesOpen ? (
          <>
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

          {toneCount === 1 ? (
            // En ensam ton har varken ackord eller ordning — bara sig själv.
            <Button
              label={`Spela ${noteNameWithOctave(live.tones[0], settings.naming)}`}
              variant="pure"
              onPress={() => playTones('chord')}
            />
          ) : (
            <>
              <Button
                label="Spela ackordet"
                variant="pure"
                onPress={() => playTones('chord')}
              />
              <View style={styles.toneButtons}>
                <Button
                  label="↑ Nedifrån och upp"
                  onPress={() => playTones('up')}
                  style={styles.toneButton}
                />
                <Button
                  label="↓ Uppifrån och ner"
                  onPress={() => playTones('down')}
                  style={styles.toneButton}
                />
              </View>
              <Button
                label="⇢ I vald ordning"
                onPress={() => playTones('chosen')}
              />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Tempo mellan tonerna</Text>
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
                Tempot sparas med låten. Nya låtar börjar på{' '}
                {settings.defaultToneGapBpm} slag/min, vilket går att ändra i
                inställningarna.
              </Text>
            </>
          )}
          </>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.keyboardCard}>
        <View style={styles.keyboardHeader}>
          <SegmentedControl
            compact
            value={live.tuningSystem}
            tint={live.tuningSystem === 'just' ? t.pure : t.accent}
            onChange={(tuningSystem) => updateLive({ tuningSystem })}
            options={[
              { value: 'tempered' as const, label: 'Tempererad' },
              { value: 'just' as const, label: 'Ren' },
            ]}
          />
          <Pressable
            onPress={toggleSelectMode}
            style={[styles.toggle, selectMode && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, selectMode && styles.toggleTextOn]}>
              Välj toner för tongivning
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
          markTonic={
            live.tuningSystem === 'just' || settings.markTonicInTempered
          }
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
              Tryck på en tangent för att höra tonen.
              {markTonic ? ' Dubbeltryck för att sätta tonika.' : ''}
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
  songBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: t.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    padding: spacing.md,
  },
  songBarText: {
    flex: 1,
  },
  songTitle: {
    color: t.text,
    fontSize: 19,
    fontWeight: '700',
  },
  songHint: {
    color: t.textMuted,
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
    color: t.text,
    fontSize: 15,
  },
  helpText: {
    color: t.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  counter: {
    color: t.textMuted,
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
    backgroundColor: t.surfaceRaised,
    borderWidth: 1,
    borderColor: t.tone,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipText: {
    color: t.text,
    fontSize: 14,
    fontWeight: '600',
  },
  chipRemove: {
    color: t.textMuted,
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
    color: t.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  keyboardCard: {
    paddingHorizontal: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardHeaderNote: {
    color: t.textMuted,
    fontSize: 13,
  },
  /** Stämningsval i ena hörnet, tonvalsläget i det andra. */
  keyboardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  tapButton: {
    // Får ta plats efter finjusteringsknapparna men inte tränga undan Starta.
    flexShrink: 1,
  },
  toggle: {
    paddingVertical: 7,
    paddingHorizontal: 12,
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
  octaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  octaveLabel: {
    color: t.textMuted,
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
    color: t.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  readoutNote: {
    color: t.text,
    fontSize: 24,
    fontWeight: '700',
  },
  readoutDetail: {
    color: t.textMuted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  readoutCents: {
    color: t.pure,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  readoutCentsNeutral: {
    color: t.textMuted,
  },
  rangeHint: {
    color: t.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
