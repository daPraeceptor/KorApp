import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { PlayScreen } from './src/screens/PlayScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SongsScreen } from './src/screens/SongsScreen';
import { AppStateProvider } from './src/state/AppState';
import { colors, radius, spacing } from './src/theme';

type Tab = 'play' | 'songs' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'play', label: 'Spela' },
  { id: 'songs', label: 'Låtar' },
  { id: 'settings', label: 'Inställningar' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('play');

  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar style="light" />
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <View style={styles.body}>
            {tab === 'play' ? <PlayScreen onOpenSongs={() => setTab('songs')} /> : null}
            {tab === 'songs' ? <SongsScreen onOpenPlay={() => setTab('play')} /> : null}
            {tab === 'settings' ? <SettingsScreen /> : null}
          </View>

          <View style={styles.tabBar}>
            {TABS.map(({ id, label }) => {
              const active = tab === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setTab(id)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    // Håller innehållet läsbart på breda skärmar när appen körs i webbläsaren.
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 620 : undefined,
    alignSelf: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.surfaceRaised,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.accent,
  },
});
