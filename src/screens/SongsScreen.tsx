/**
 * Låtbiblioteket: skapa, byta namn på, ladda och ta bort låtar.
 *
 * Låtar kan samlas i mappar — en per konsert, termin eller vad körledaren
 * behöver. Mappar är avsiktligt platta: en nivå räcker för ett repertoarregister,
 * och slipper man undermappar slipper man också fundera på var en låt tog vägen.
 */
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Card, SectionTitle } from '../components/ui';
import { useAppState } from '../state/AppState';
import { Song, searchSongs } from '../store/songs';
import { noteName, noteNameWithOctave } from '../theory/tuning';
import { Palette, radius, spacing } from '../theme';
import { useTheme, useThemedStyles } from '../ThemeContext';

export function SongsScreen({ onOpenPlay }: { onOpenPlay: () => void }) {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {
    songs,
    folders,
    currentSong,
    settings,
    metronomeRunning,
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
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [draftFolderName, setDraftFolderName] = useState('');
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(
    null,
  );

  const searching = query.trim().length > 0;
  const matches = useMemo(() => searchSongs(songs, query), [songs, query]);
  const loose = matches.filter((song) => song.folderId === null);

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

    return (
      <Card key={song.id} style={isCurrent ? styles.currentCard : undefined}>
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
          <Pressable
            onPress={() => {
              loadSong(song.id);
              onOpenPlay();
            }}
          >
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {song.title}
              </Text>
              {isCurrent ? <Text style={styles.badge}>Laddad</Text> : null}
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
          </Pressable>
        )}

        <View style={styles.quickRow}>
          <Button
            label={isPlayingTempo ? '■ Stoppa tempo' : '▶ Tempo'}
            variant={isPlayingTempo ? 'default' : 'primary'}
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

        {isConfirming ? (
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
              label="Ladda"
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

            {isConfirmingFolder ? (
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
  currentCard: {
    borderColor: t.accent,
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
  badge: {
    color: t.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
