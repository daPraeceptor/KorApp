/** Låtbiblioteket: skapa, byta namn på, ladda och ta bort låtar. */
import React, { useState } from 'react';
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
import { noteName, noteNameWithOctave } from '../theory/tuning';
import { colors, radius, spacing } from '../theme';

export function SongsScreen({ onOpenPlay }: { onOpenPlay: () => void }) {
  const {
    songs,
    currentSong,
    live,
    settings,
    metronomeRunning,
    loadSong,
    addSong,
    updateSong,
    deleteSong,
    playTones,
    playSongTempo,
    stopMetronome,
  } = useAppState();

  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const create = () => {
    addSong(newTitle);
    setNewTitle('');
    onOpenPlay();
  };

  const beginRename = (id: string, title: string) => {
    setEditingId(id);
    setDraftTitle(title);
    setConfirmDeleteId(null);
  };

  const commitRename = () => {
    if (editingId) {
      updateSong(editingId, { title: draftTitle.trim() || 'Namnlös låt' });
    }
    setEditingId(null);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <SectionTitle>Ny låt</SectionTitle>
        <Text style={styles.help}>
          Den nya låten sparas med tempot, taktarten, stämningen och tonerna som
          just nu är inställda i spelvyn: {live.bpm} slag/min,{' '}
          {live.tuningSystem === 'just'
            ? `ren stämning med ${noteName(live.tonicPitchClass, settings.naming)} som tonika`
            : 'tempererad stämning'}
          {live.tones.length > 0
            ? `, ${live.tones.length} ${live.tones.length === 1 ? 'ton' : 'toner'}`
            : ''}
          .
        </Text>
        <TextInput
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="Namn på låten"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={create}
        />
        <Button label="Lägg till låt" variant="primary" onPress={create} />
      </Card>

      <SectionTitle>Sparade låtar ({songs.length})</SectionTitle>

      {songs.length === 0 ? (
        <Card>
          <Text style={styles.help}>
            Inga låtar sparade än. Ställ in tempo och toner i spelvyn och lägg
            till låten här.
          </Text>
        </Card>
      ) : null}

      {songs.map((song) => {
        const isCurrent = currentSong?.id === song.id;
        const isEditing = editingId === song.id;
        const isConfirming = confirmDeleteId === song.id;
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
                onPress={() => playTones('together', song)}
                style={styles.quickButton}
              />
              <Button
                label="♪ En och en"
                disabled={song.tones.length === 0}
                onPress={() => playTones('arpeggio', song)}
                style={styles.quickButton}
              />
            </View>

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
      })}
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
  currentCard: {
    borderColor: colors.accent,
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  editRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    color: '#12121a',
    backgroundColor: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  tones: {
    color: colors.tone,
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  tonesEmpty: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  quickButton: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 11,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  confirmText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  help: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
