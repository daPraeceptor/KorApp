/**
 * Låtbiblioteket: skapa, byta namn på, ladda och ta bort låtar.
 *
 * Låtar kan samlas i mappar — en per konsert, termin eller vad körledaren
 * behöver. Mappar är avsiktligt platta: en nivå räcker för ett repertoarregister,
 * och slipper man undermappar slipper man också fundera på var en låt tog vägen.
 */
import React, { useEffect, useMemo, useReducer, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Button, Card, SectionTitle, SlideToConfirm } from '../components/ui';
import { Keyboard } from '../components/Keyboard';
import { BeatPulse, useAppState } from '../state/AppState';
import { Song, searchSongs } from '../store/songs';
import { noteName, noteNameWithOctave } from '../theory/tuning';
import { Palette, radius, spacing } from '../theme';
import { useTheme, useThemedStyles } from '../ThemeContext';

/**
 * Liten metronom som pendlar i låtens eget tempo. En blick över listan visar
 * hur låtarnas tempon förhåller sig till varandra, utan siffror.
 */
function MiniMetronome({
  bpm,
  color,
  pulse,
}: {
  bpm: number;
  color: string;
  /**
   * Senaste hörda taktslaget när den här låtens tempo spelas. Med det ankras
   * pendeln i ljudet och vänder precis på klicket — en fristående klocka
   * glider annars ur fas med det man hör.
   */
  pulse?: BeatPulse | null;
}) {
  const [, tick] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Ett slag per svängning från kant till kant, som på en riktig metronom.
  const beatMs = 60000 / bpm;
  let vinkel: number;
  if (pulse) {
    // Samma räkning som stora taktvisaren: andel av slaget sedan klicket,
    // med vändning i ytterläget precis på slaget.
    const fas = Math.min(Math.max((Date.now() - pulse.at) / beatMs, 0), 1);
    const riktning = pulse.count % 2 === 1 ? -1 : 1;
    vinkel = riktning * 0.42 * Math.cos(Math.PI * fas);
  } else {
    const beats = (Date.now() / 1000) * (bpm / 60);
    vinkel = Math.sin(Math.PI * beats) * 0.42;
  }
  const längd = 13;
  const toppX = 11 + längd * Math.sin(vinkel);
  const toppY = 17.5 - längd * Math.cos(vinkel);

  return (
    <Svg width={22} height={20} viewBox="0 0 22 20">
      {/* Kroppen: en låg trapets som antyder metronomlådan. */}
      <Path d="M7 19 L9.2 12 h3.6 L15 19 z" fill={color} opacity={0.35} />
      <Line
        x1={11}
        y1={17.5}
        x2={toppX}
        y2={toppY}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Circle
        cx={11 + (längd - 4) * Math.sin(vinkel)}
        cy={17.5 - (längd - 4) * Math.cos(vinkel)}
        r={2.1}
        fill={color}
      />
    </Svg>
  );
}

/** Överstruken högtalare: tystnad — trycket stoppar det som spelas. */
function MutedSpeakerIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M3 7.4 h3 L10.6 4 v12 L6 12.6 H3 z" fill={color} />
      <Line
        x1={13}
        y1={7.5}
        x2={17.5}
        y2={12.5}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line
        x1={17.5}
        y1={7.5}
        x2={13}
        y2={12.5}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SongsScreen({
  onOpenPlay,
  locked = false,
  onLock,
}: {
  onOpenPlay: () => void;
  /** I konsertläget går det bara att spela upp — inget går att ändra. */
  locked?: boolean;
  onLock?: () => void;
}) {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {
    songs,
    folders,
    currentSong,
    settings,
    metronomeRunning,
    pulse,
    loadSong,
    updateSong,
    deleteSong,
    addFolder,
    renameFolder,
    deleteFolder,
    moveSongToFolder,
    playTones,
    playSongTempo,
    stopMetronome,
  } = useAppState();

  const [newFolderName, setNewFolderName] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  /** Låten vars kort är uppfällt med spelbart piano. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [draftFolderName, setDraftFolderName] = useState('');
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(
    null,
  );

  const searching = query.trim().length > 0;
  const matches = useMemo(() => searchSongs(songs, query), [songs, query]);
  const loose = matches.filter((song) => song.folderId === null);

  // Halvfärdiga redigeringar stängs när låset slår till, annars står en
  // öppen namnruta kvar och går att skriva i fast läget är låst.
  useEffect(() => {
    if (locked) {
      setEditingId(null);
      setConfirmDeleteId(null);
      setMovingId(null);
      setEditingFolderId(null);
      setConfirmDeleteFolderId(null);
    }
  }, [locked]);

  const beginRename = (id: string, title: string) => {
    setEditingId(id);
    setDraftTitle(title);
    setConfirmDeleteId(null);
    setMovingId(null);
  };

  const commitRename = () => {
    if (editingId) {
      updateSong(editingId, { title: draftTitle.trim() || 'Namnlös låt' });
    }
    setEditingId(null);
  };

  const toggleFolder = (id: string) =>
    setCollapsed((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const renderSong = (song: Song) => {
    const isCurrent = currentSong?.id === song.id;
    const isEditing = editingId === song.id;
    const isConfirming = confirmDeleteId === song.id;
    const isMoving = movingId === song.id;
    const isPlayingTempo = isCurrent && metronomeRunning;
    const isExpanded = expandedId === song.id;

    return (
      <Card
        key={song.id}
        // Den valda låten får accentramen — samma ram som när metronomen går.
        style={isCurrent ? styles.currentCard : undefined}
        // Ett tryck var som helst i rutan väljer låten och fäller upp
        // pianot. Ren uppspelning, därför tillåtet även i konsertläget —
        // knapparna i rutan tar sina egna tryck som vanligt.
        onPress={() => {
          loadSong(song.id);
          setExpandedId((current) => (current === song.id ? null : song.id));
        }}
      >
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              style={[styles.input, styles.editInput]}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={commitRename}
            />
            <Button label="Klart" variant="primary" onPress={commitRename} />
          </View>
        ) : (
          <View>
            <View style={styles.titleRow}>
              <MiniMetronome
                bpm={song.bpm}
                color={isPlayingTempo ? t.accent : t.textMuted}
                pulse={isPlayingTempo ? pulse : null}
              />
              <Text style={styles.title} numberOfLines={2}>
                {song.title}
              </Text>
            </View>
            <Text style={styles.meta}>
              {song.bpm} slag/min · {song.beatsPerBar}/4 ·{' '}
              {song.tuningSystem === 'just'
                ? `ren, tonika ${noteName(song.tonicPitchClass, settings.naming)}`
                : 'tempererad'}
            </Text>
            {song.tones.length > 0 ? (
              <Text style={styles.tones}>
                Toner:{' '}
                {song.tones
                  .map((midi) => noteNameWithOctave(midi, settings.naming))
                  .join('  ')}
              </Text>
            ) : (
              <Text style={styles.tonesEmpty}>Inga sparade toner</Text>
            )}
          </View>
        )}

        <View style={styles.quickRow}>
          <Button
            label={isPlayingTempo ? 'Stoppa tempo' : '▶ Tempo'}
            renderIcon={
              isPlayingTempo
                ? (color) => <MutedSpeakerIcon color={color} />
                : undefined
            }
            variant="primary"
            onPress={() =>
              isPlayingTempo ? stopMetronome() : void playSongTempo(song)
            }
            style={styles.quickButton}
          />
          <Button
            label="♪ Ackord"
            variant="pure"
            disabled={song.tones.length === 0}
            onPress={() => playTones('chord', song)}
            style={styles.quickButton}
          />
          <Button
            label="♪ ↑"
            disabled={song.tones.length === 0}
            onPress={() => playTones('up', song)}
            style={styles.quickButton}
          />
          <Button
            label="♪ ↓"
            disabled={song.tones.length === 0}
            onPress={() => playTones('down', song)}
            style={styles.quickButton}
          />
          <Button
            label="♪ ⇢"
            disabled={song.tones.length === 0}
            onPress={() => playTones('chosen', song)}
            style={styles.quickButton}
          />
        </View>

        {/* Uppfällt kort: piano där bara låtens toner går att spela, i låtens
            egen stämning. Ren uppspelning — inget går att ändra härifrån. */}
        {isExpanded ? (
          song.tones.length > 0 ? (
            <Keyboard
              fromMidi={Math.max(0, Math.min(...song.tones) - 2)}
              toMidi={Math.min(127, Math.max(...song.tones) + 2)}
              tuning={{
                system: song.tuningSystem,
                tonicPitchClass: song.tonicPitchClass,
                a4: settings.a4,
              }}
              labels={{
                system: settings.labelSystem,
                naming: settings.naming,
                reference: settings.labelReference,
                tonicPitchClass: song.tonicPitchClass,
              }}
              showLabels={settings.showNoteNames}
              markTonic={song.tuningSystem === 'just'}
              selectedTones={song.tones}
              selectMode={false}
              playableTones={song.tones}
              onSetTonic={() => {}}
              onToggleTone={() => {}}
            />
          ) : (
            <Text style={styles.help}>
              Inga sparade toner att spela. Lägg till toner via «Ändra».
            </Text>
          )
        ) : null}

        {isMoving ? (
          <View style={styles.moveBox}>
            <Text style={styles.moveLabel}>Flytta till</Text>
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => {
                  moveSongToFolder(song.id, null);
                  setMovingId(null);
                }}
                style={[styles.chip, song.folderId === null && styles.chipOn]}
              >
                <Text
                  style={[
                    styles.chipText,
                    song.folderId === null && styles.chipTextOn,
                  ]}
                >
                  Ingen mapp
                </Text>
              </Pressable>
              {folders.map((folder) => (
                <Pressable
                  key={folder.id}
                  onPress={() => {
                    moveSongToFolder(song.id, folder.id);
                    setMovingId(null);
                  }}
                  style={[
                    styles.chip,
                    song.folderId === folder.id && styles.chipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      song.folderId === folder.id && styles.chipTextOn,
                    ]}
                  >
                    {folder.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            {folders.length === 0 ? (
              <Text style={styles.help}>
                Du har inga mappar än. Skapa en högst upp i listan.
              </Text>
            ) : null}
            <Button
              label="Avbryt"
              variant="ghost"
              onPress={() => setMovingId(null)}
            />
          </View>
        ) : null}

        {locked ? null : isConfirming ? (
          <View style={styles.actions}>
            <Text style={styles.confirmText}>Ta bort «{song.title}»?</Text>
            <Button
              label="Avbryt"
              variant="ghost"
              onPress={() => setConfirmDeleteId(null)}
            />
            <Button
              label="Ta bort"
              variant="danger"
              onPress={() => {
                deleteSong(song.id);
                setConfirmDeleteId(null);
              }}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            <Button
              label="Ändra"
              onPress={() => {
                loadSong(song.id);
                onOpenPlay();
              }}
            />
            <Button
              label="Flytta"
              variant="ghost"
              onPress={() => {
                setMovingId(isMoving ? null : song.id);
                setEditingId(null);
              }}
            />
            <Button
              label="Byt namn"
              variant="ghost"
              onPress={() => beginRename(song.id, song.title)}
            />
            <Button
              label="Ta bort"
              variant="danger"
              onPress={() => setConfirmDeleteId(song.id)}
            />
          </View>
        )}
      </Card>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {locked ? (
        <Card>
          <Text style={styles.help}>
            Appen är låst i konsertläge: bara uppspelning är möjlig. Lås upp
            genom att dra låset längst ner åt höger.
          </Text>
        </Card>
      ) : null}

      {songs.length > 0 ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Sök bland låtarna"
          placeholderTextColor={t.textMuted}
          style={styles.search}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      ) : null}

      {searching ? (
        <Text style={styles.searchInfo}>
          {matches.length === 0
            ? `Ingen låt matchar «${query.trim()}».`
            : `${matches.length} ${matches.length === 1 ? 'träff' : 'träffar'} på «${query.trim()}».`}
        </Text>
      ) : null}

      {songs.length === 0 ? (
        <Card>
          <Text style={styles.help}>
            Inga låtar sparade än. Ställ in tempo och toner i spelvyn och lägg
            till låten här.
          </Text>
        </Card>
      ) : null}

      {folders.map((folder) => {
        const inFolder = matches.filter((song) => song.folderId === folder.id);
        // Under sökning fälls mappar med träffar upp, annars göms svaret.
        const open = searching ? inFolder.length > 0 : !collapsed.includes(folder.id);
        const isEditingFolder = editingFolderId === folder.id;
        const isConfirmingFolder = confirmDeleteFolderId === folder.id;

        if (searching && inFolder.length === 0) {
          return null;
        }

        return (
          <View key={folder.id} style={styles.folder}>
            {isEditingFolder ? (
              <View style={styles.editRow}>
                <TextInput
                  value={draftFolderName}
                  onChangeText={setDraftFolderName}
                  style={[styles.input, styles.editInput]}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    renameFolder(folder.id, draftFolderName);
                    setEditingFolderId(null);
                  }}
                />
                <Button
                  label="Klart"
                  variant="primary"
                  onPress={() => {
                    renameFolder(folder.id, draftFolderName);
                    setEditingFolderId(null);
                  }}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => toggleFolder(folder.id)}
                style={styles.folderHeader}
              >
                <Text style={styles.folderName}>
                  {open ? '▾' : '▸'}  {folder.name}
                </Text>
                <Text style={styles.folderCount}>
                  {inFolder.length} {inFolder.length === 1 ? 'låt' : 'låtar'}
                </Text>
              </Pressable>
            )}

            {locked ? null : isConfirmingFolder ? (
              <View style={styles.actions}>
                <Text style={styles.confirmText}>
                  Ta bort mappen «{folder.name}»? Låtarna blir kvar.
                </Text>
                <Button
                  label="Avbryt"
                  variant="ghost"
                  onPress={() => setConfirmDeleteFolderId(null)}
                />
                <Button
                  label="Ta bort mapp"
                  variant="danger"
                  onPress={() => {
                    deleteFolder(folder.id);
                    setConfirmDeleteFolderId(null);
                  }}
                />
              </View>
            ) : (
              <View style={styles.folderActions}>
                <Button
                  label="Byt namn"
                  variant="ghost"
                  onPress={() => {
                    setEditingFolderId(folder.id);
                    setDraftFolderName(folder.name);
                  }}
                />
                <Button
                  label="Ta bort mapp"
                  variant="ghost"
                  onPress={() => setConfirmDeleteFolderId(folder.id)}
                />
              </View>
            )}

            {open ? (
              <View style={styles.folderBody}>
                {inFolder.length === 0 ? (
                  <Text style={styles.help}>
                    Mappen är tom. Använd «Flytta» på en låt för att lägga den här.
                  </Text>
                ) : (
                  inFolder.map(renderSong)
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      {loose.length > 0 || (!searching && folders.length > 0) ? (
        <SectionTitle>
          {folders.length > 0 ? `Utanför mappar (${loose.length})` : `Sparade låtar (${loose.length})`}
        </SectionTitle>
      ) : null}

      {loose.map(renderSong)}

      {/* Mappskapandet ligger under låtarna: det används sällan och ska inte
          stå i vägen för listan man faktiskt kom för. Göms i låst läge. */}
      {locked ? null : (
        <Card>
          <SectionTitle>Ny mapp</SectionTitle>
          <View style={styles.editRow}>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Namn på mappen"
              placeholderTextColor={t.textMuted}
              style={[styles.input, styles.editInput]}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (newFolderName.trim()) {
                  addFolder(newFolderName);
                  setNewFolderName('');
                }
              }}
            />
            <Button
              label="Skapa"
              disabled={!newFolderName.trim()}
              onPress={() => {
                addFolder(newFolderName);
                setNewFolderName('');
              }}
            />
          </View>
        </Card>
      )}

      {/* Samma draggest åt båda hållen: in i konsertläget och ut ur det. */}
      {!locked && songs.length > 0 ? (
        <Card>
          <SectionTitle>Konsertläge</SectionTitle>
          <Text style={styles.help}>
            Låser appen till uppspelning: inga låtar eller inställningar går
            att ändra, och bara listan visas. Bra när telefonen ligger framme
            på notstället.
          </Text>
          <View style={styles.lockRow}>
            <SlideToConfirm
              hint="Dra låset åt höger för att låsa"
              onConfirm={onLock ?? (() => {})}
            />
          </View>
        </Card>
      ) : null}
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
  help: {
    color: t.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  // Dragbanan fyller radens bredd — utan raden runt om har flex ingen riktning.
  lockRow: {
    flexDirection: 'row',
  },
  input: {
    backgroundColor: t.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.border,
    color: t.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  search: {
    backgroundColor: t.surfaceRaised,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
    color: t.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  searchInfo: {
    color: t.textMuted,
    fontSize: 12,
    marginTop: -spacing.xs,
  },
  editRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
  },
  folder: {
    backgroundColor: t.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  folderName: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  folderCount: {
    color: t.textMuted,
    fontSize: 12,
  },
  folderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  folderBody: {
    gap: spacing.sm,
  },
  // Den valda låtens ruta lyser med accentram och tonad botten — samma
  // markering vare sig den valdes med ett tryck eller genom att tempot
  // startades.
  currentCard: {
    borderColor: t.accent,
    backgroundColor: t.accentSurface,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: t.text,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  meta: {
    color: t.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  tones: {
    color: t.pure,
    fontSize: 13,
    marginTop: 4,
  },
  tonesEmpty: {
    color: t.textMuted,
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  quickButton: {
    flexGrow: 1,
    flexBasis: 84,
    paddingHorizontal: 6,
    paddingVertical: 11,
  },
  moveBox: {
    backgroundColor: t.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  moveLabel: {
    color: t.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  chipOn: {
    backgroundColor: t.accent,
    borderColor: t.accent,
  },
  chipText: {
    color: t.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextOn: {
    color: t.onAccent,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  confirmText: {
    color: t.text,
    fontSize: 13,
    flex: 1,
  },
});
