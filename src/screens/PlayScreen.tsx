/**
 * Spelvyn: tempo, taktart, stämning och körens starttoner på en och samma skärm,
 * så att körledaren slipper byta vy mitt i en repetition.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
import { MetronomeVisualStyle, useAppState } from '../state/AppState';
import {
  centsFromTempered,
  frequencyOf,
  intervalName,
  noteLabel,
  noteNameWithOctave,
  ratioLabel,
} from '../theory/tuning';
import { MAX_TONES } from '../store/songs';
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
    addSong,
    updateSong,
    updateSettings,
  } = useAppState();

  const [selectMode, setSelectMode] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  /**
   * Namnrutan följer den laddade låten, så att namnet står där när man
   * uppdaterar — och kan ändras i samma veva. Utan låt töms rutan inför
   * nästa nya låt.
   */
  useEffect(() => {
    setTitleDraft(currentSong ? currentSong.title : '');
  }, [currentSong?.id, currentSong?.title]);

  const titleChanged =
    currentSong !== null &&
    titleDraft.trim() !== '' &&
    titleDraft.trim() !== currentSong.title;

  const cycleVisual = useCallback(() => {
    const ordning: MetronomeVisualStyle[] = ['ball', 'pendulum', 'bar'];
    const index = ordning.indexOf(settings.metronomeVisual);
    // En avstängd visare ("none", index -1) börjar om från bollen.
    updateSettings({ metronomeVisual: ordning[(index + 1) % ordning.length] });
  }, [settings.metronomeVisual, updateSettings]);

  const updateCurrent = useCallback(() => {
    if (!currentSong) {
      return;
    }
    const namn = titleDraft.trim();
    if (namn && namn !== currentSong.title) {
      updateSong(currentSong.id, { title: namn });
    }
    saveToCurrentSong();
  }, [currentSong, titleDraft, updateSong, saveToCurrentSong]);
  const [playedNote, setPlayedNote] = useState<number | null>(null);
  const [keyboardStart, setKeyboardStart] = useState(48);
  const [wheelDragging, setWheelDragging] = useState(false);
  const [meterOpen, setMeterOpen] = useState(true);
  const [tonesOpen, setTonesOpen] = useState(true);
  const taps = useRef<number[]>([]);
  const föregåendeAntalToner = useRef(live.tones.length);

  /**
   * Tongivningskortet ligger ovanför klaviaturen, så allt under det flyttar sig
   * när kortet växer eller krymper. Klaviaturen är det man siktar med fingret
   * på — den får inte hoppa. Vyn rullas därför så att kortets underkant, och
   * med den allt nedanför, hamnar tillbaka på samma ställe på skärmen.
   */
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  /** Kortets underkant i innehållets koordinater, från senaste mätningen. */
  const tonesBottom = useRef(0);
  /** Skärmläget underkanten ska återfå. null betyder att inget är på gång. */
  const wantedBottomY = useRef<number | null>(null);
  const armedUntil = useRef(0);

  /**
   * Låser fast var klaviaturen står, precis innan något ändrar kortets höjd.
   *
   * Läget mäts här och inte i layout-mätningen, för när innehållet krymper
   * justerar webbläsaren själv rullningen innan mätningen kommer — räknar man
   * på höjdskillnaden i stället blir den justeringen dubbelräknad.
   */
  const keepKeyboardStill = useCallback(() => {
    // Utan tidigare mätning finns kortet inte ännu och har inget läge att hålla.
    if (tonesBottom.current === 0) {
      return;
    }
    wantedBottomY.current = tonesBottom.current - scrollY.current;
    // En omflyttning kan kräva flera mätningar, men bara i direkt anslutning
    // till trycket. Fönstret hindrar en långt senare mätning från att rycka
    // tillbaka vyn efter att körledaren rullat själv.
    armedUntil.current = Date.now() + 500;
  }, []);

  const onTonesLayout = useCallback((e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    tonesBottom.current = y + height;
    if (wantedBottomY.current === null) {
      return;
    }
    if (Date.now() > armedUntil.current) {
      wantedBottomY.current = null;
      return;
    }
    const skillnad =
      tonesBottom.current - scrollY.current - wantedBottomY.current;
    if (Math.abs(skillnad) > 1) {
      scrollRef.current?.scrollTo({ y: scrollY.current + skillnad, animated: false });
    }
  }, []);

  const toggleTonesOpen = useCallback(() => {
    keepKeyboardStill();
    setTonesOpen((open) => !open);
  }, [keepKeyboardStill]);

  const toggleTone = useCallback(
    (midi: number) => {
      keepKeyboardStill();
      toggleSongTone(midi);
    },
    [keepKeyboardStill, toggleSongTone],
  );

  /**
   * Tonvalet öppnar kortet hopfällt med en instruktion, så att klaviaturen
   * hamnar i blickfånget i stället för en tom knapprad. Första tonen fäller
   * upp det igen — då finns det något att se.
   */
  const toggleSelectMode = useCallback(() => {
    keepKeyboardStill();
    if (!selectMode && live.tones.length === 0) {
      setTonesOpen(false);
    }
    setSelectMode((current) => !current);
  }, [keepKeyboardStill, selectMode, live.tones.length]);

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
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      // Vyn får inte rulla iväg under fingret medan tempohjulet vrids.
      scrollEnabled={!wheelDragging}
      scrollEventThrottle={16}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
      }}
    >
      {/* Utan laddad låt finns inget att visa här — listfliken är vägen till
          låtarna, och en ruta som bara säger "ingen låt" tar plats i onödan. */}
      {currentSong ? (
        <Pressable style={styles.songBar} onPress={onOpenSongs}>
          <View style={styles.songBarText}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {currentSong.title}
            </Text>
            <Text style={styles.songHint}>Tryck för att byta låt</Text>
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
      ) : null}

      {/* Ett tryck på taktvisaren bläddrar till nästa stil. "Ingen" ingår
          inte i bläddringen — en osynlig visare går inte att trycka på. */}
      <Pressable onPress={cycleVisual}>
        <MetronomeVisual
          style={settings.metronomeVisual}
          running={metronomeRunning}
          bpm={live.bpm}
          pulse={pulse}
          activeBeat={activeBeat}
        />
      </Pressable>

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
        <Card onLayout={onTonesLayout}>
          <Pressable onPress={toggleTonesOpen} style={styles.cardHeader}>
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

          {/* Utan toner finns inget att spela. Då visas instruktionen i stället
              för knappar som ändå inte gör något. */}
          {toneCount === 0 ? (
            <Text style={styles.helpText}>
              Tryck på en tangent på klaviaturen för att lägga till en ton.
            </Text>
          ) : tonesOpen ? (
          <>
          <View style={styles.chips}>
            {live.tones.map((midi) => (
              <Pressable
                key={midi}
                onPress={() => toggleTone(midi)}
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
              {/* Den valda ordningen är den vanligaste tongivningen och får
                  därför egen rad överst. */}
              <Button
                label="⇢ I vald ordning"
                variant="pure"
                onPress={() => playTones('chosen')}
              />
              <View style={styles.toneButtons}>
                <Button
                  label="Ackord"
                  onPress={() => playTones('chord')}
                  style={styles.toneButton}
                />
                <Button
                  label="↑ Upp"
                  onPress={() => playTones('up')}
                  style={styles.toneButton}
                />
                <Button
                  label="↓ Ner"
                  onPress={() => playTones('down')}
                  style={styles.toneButton}
                />
              </View>
            </>
          )}
          </>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.keyboardCard}>
        <View style={styles.keyboardHeader}>
          <Pressable
            onPress={toggleSelectMode}
            style={[styles.toggle, selectMode && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, selectMode && styles.toggleTextOn]}>
              Välj toner för tongivning
            </Text>
          </Pressable>
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
          onToggleTone={toggleTone}
          onNotePlayed={setPlayedNote}
        />

        <View style={styles.readout}>
          {/* Tom i vila — ytan behåller sin höjd så att inget hoppar när en
              ton spelas och avläsningen dyker upp. */}
          {displayedNote === null ? null : (
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

      {/* Sparandet bor längst ner: här skapas en ny låt av det som är inställt
          ovan, eller uppdateras den laddade. */}
      <Card>
        <SectionTitle>{currentSong ? 'Spara' : 'Ny låt'}</SectionTitle>
        <Text style={styles.helpText}>
          Låten sparas med tempot, taktarten, stämningen och tonerna som är
          inställda ovan.
        </Text>
        <TextInput
          value={titleDraft}
          onChangeText={setTitleDraft}
          placeholder="Namn på låten"
          placeholderTextColor={t.textMuted}
          style={styles.titleInput}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (!currentSong) {
              addSong(titleDraft);
            }
          }}
        />
        {currentSong ? (
          <View style={styles.saveRow}>
            <Button
              label="Uppdatera"
              variant="primary"
              // Ett ändrat namn är också en ändring värd att spara, även om
              // tempot och tonerna står orörda.
              disabled={!hasUnsavedChanges && !titleChanged}
              onPress={updateCurrent}
              style={styles.saveRowButton}
            />
            <Button
              label="Spara som ny"
              onPress={() => {
                // Med orört namn får kopian ett eget, annars krockar två
                // likadana titlar i listan.
                addSong(
                  titleChanged ? titleDraft : `${currentSong.title} (kopia)`,
                );
              }}
              style={styles.saveRowButton}
            />
          </View>
        ) : (
          <Button
            label="Skapa ny låt"
            variant="primary"
            onPress={() => addSong(titleDraft)}
          />
        )}
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
  keyboardCard: {
    paddingHorizontal: spacing.sm,
  },
  titleInput: {
    backgroundColor: t.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.border,
    color: t.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  saveRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  saveRowButton: {
    flex: 1,
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
  // Accentfärgad även i vila — det här är vägen in till tonvalet och ska
  // synas. Påslaget läge byter till tonfärgen, samma färg som tonernas
  // markeringar på tangenterna.
  toggle: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.accent,
    backgroundColor: t.accent,
  },
  toggleOn: {
    backgroundColor: t.tone,
    borderColor: t.tone,
  },
  toggleText: {
    color: t.onAccent,
    fontSize: 13,
    fontWeight: '700',
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
