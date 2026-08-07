import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { PlayScreen } from './src/screens/PlayScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SongsScreen } from './src/screens/SongsScreen';
import { AppStateProvider } from './src/state/AppState';
import { Palette, radius, spacing } from './src/theme';
import { useTheme, useThemedStyles } from './src/ThemeContext';

type Tab = 'play' | 'songs' | 'settings';

// Spelvyn är där man skapar en ny låt, därav plustecknet. Kugghjulet skrivs
// med variantväljaren U+FE0E så att det ritas som glyf i textens färg och
// inte som färgglad emoji.
const TABS: { id: Tab; label: string; symbol?: boolean }[] = [
  { id: 'play', label: '+', symbol: true },
  { id: 'songs', label: 'Låtar' },
  { id: 'settings', label: '⚙︎', symbol: true },
];

/**
 * Skalet ligger i en egen komponent eftersom App renderar temaleverantören —
 * färgerna finns först innanför den, inte i samma komponent som skapar den.
 */
function Shell() {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [tab, setTab] = useState<Tab>('play');

  return (
    <>
      {/* Ljusa teman behöver mörk statusradstext, annars försvinner klockan. */}
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.body}>
          {tab === 'play' ? <PlayScreen onOpenSongs={() => setTab('songs')} /> : null}
          {tab === 'songs' ? <SongsScreen onOpenPlay={() => setTab('play')} /> : null}
          {tab === 'settings' ? <SettingsScreen /> : null}
        </View>

        <View style={styles.tabBar}>
          {TABS.map(({ id, label, symbol }) => {
            const active = tab === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    symbol && styles.tabSymbol,
                    active && styles.tabLabelActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <Shell />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.background,
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
    borderTopColor: t.border,
    backgroundColor: t.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  // Vald flik fylls med accentfärgen, som appens huvudknappar. En tonad botten
  // med färgad text syntes inte i ögonvrån.
  tabActive: {
    backgroundColor: t.accent,
  },
  tabLabel: {
    color: t.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  // Ensamma tecken ritas större än orden, annars ser de förkrympta ut.
  // Radhöjden hålls nere så att flikarna inte blir högre av det.
  tabSymbol: {
    fontSize: 19,
    lineHeight: 19,
  },
  tabLabelActive: {
    color: t.onAccent,
    fontWeight: '700',
  },
});
