import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { LockGlyph, SlideToConfirm } from './src/components/ui';
import { PlayScreen } from './src/screens/PlayScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SongsScreen } from './src/screens/SongsScreen';
import { fårVridas } from './src/rotation';
// Ändelsen plockas bort av Metro, som väljer rotationslas.native.ts på
// telefonen. Se metro.config.js.
import { ställRotation } from './src/rotationslas.ts';
import { AppStateProvider, useAppState } from './src/state/AppState';
import { Palette, radius, spacing } from './src/theme';
import { useTheme, useThemedStyles } from './src/ThemeContext';

type Tab = 'play' | 'songs' | 'settings';

/**
 * Upplåsningen bor där flikraden brukar vara. Samma draggest som låsningen i
 * listan, så att båda hållen tål en tumme som råkar landa på skärmen.
 */
function UnlockBar({ onUnlock }: { onUnlock: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.tabBar}>
      <SlideToConfirm
        hint="Dra låset åt höger för att låsa upp"
        onConfirm={onUnlock}
      />
    </View>
  );
}

/**
 * Kugghjul ritat som ring med tomt nav — textglyfen ⚙ ritar en prick mitt i
 * hålet, och pricken stör i så liten storlek.
 */
function GearIcon({ color }: { color: string }) {
  const tänder = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      {tänder.map((vinkel, i) => (
        <Line
          key={i}
          x1={10 + 6 * Math.sin(vinkel)}
          y1={10 - 6 * Math.cos(vinkel)}
          x2={10 + 8.4 * Math.sin(vinkel)}
          y2={10 - 8.4 * Math.cos(vinkel)}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
      ))}
      <Circle cx={10} cy={10} r={4.8} stroke={color} strokeWidth={3} fill="none" />
    </Svg>
  );
}

/** Den klassiska redigeringspennan: spelvyn redigerar den laddade låten. */
/**
 * Apples redigeringssymbol — pennan som skriver på ett papper, samma
 * bild som pennan i låtlistans kort («square.and.pencil»).
 */
function EditIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M20 13 V18.5 A2.5 2.5 0 0 1 17.5 21 H5.5 A2.5 2.5 0 0 1 3 18.5 V6.5 A2.5 2.5 0 0 1 5.5 4 H11"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M20.9 3.1a2 2 0 0 0-2.83 0l-7.4 7.4a1 1 0 0 0-.26.45l-.9 3.3a.55.55 0 0 0 .68.68l3.3-.9a1 1 0 0 0 .45-.26l7.4-7.4a2 2 0 0 0 0-2.83z"
        fill={color}
      />
    </Svg>
  );
}

/** Punktlista: punkt och rad, tre gånger. Unicode har ingen sådan glyf. */
function ListIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={19} viewBox="0 0 20 19">
      {[3, 9.5, 16].map((y) => (
        <React.Fragment key={y}>
          <Circle cx={2.2} cy={y} r={1.7} fill={color} />
          <Line
            x1={7.2}
            y1={y}
            x2={18.5}
            y2={y}
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </React.Fragment>
      ))}
    </Svg>
  );
}

// Spelvyn är där man skapar en ny låt, därav plustecknet. Kugghjulet skrivs
// med variantväljaren U+FE0E så att det ritas som glyf i textens färg och
// inte som färgglad emoji.
const TABS: {
  id: Tab;
  label?: string;
  symbol?: boolean;
  icon?: (color: string) => React.ReactNode;
  /** Kryper ihop till innehållets bredd i stället för att dela raden. */
  compact?: boolean;
}[] = [
  { id: 'play', label: '+', symbol: true },
  { id: 'songs', icon: (color) => <ListIcon color={color} /> },
  { id: 'settings', icon: (color) => <GearIcon color={color} />, compact: true },
];

/**
 * Skalet ligger i en egen komponent eftersom App renderar temaleverantören —
 * färgerna finns först innanför den, inte i samma komponent som skapar den.
 */
function Shell() {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { currentSong, settings, songs, loaded } = useAppState();
  const [tab, setTab] = useState<Tab>('play');

  /**
   * Startfliken väljs först när lagringen är inläst — innan dess vet appen
   * varken vad som är valt eller om det finns låtar. Bara en gång: byter
   * användaren flik själv ska ingen sen inläsning rycka tillbaka vyn.
   */
  const startApplied = useRef(false);
  useEffect(() => {
    if (loaded && !startApplied.current) {
      startApplied.current = true;
      const start =
        settings.startTab === 'auto'
          ? songs.length > 0
            ? 'songs'
            : 'play'
          : settings.startTab;
      setTab(start);
    }
  }, [loaded, settings.startTab, songs.length]);
  /**
   * Konsertläget låser appen till låtlistan och uppspelning. Låset sparas
   * med flit inte: en omstart låser upp, så att ingen blir kvar utestängd.
   */
  const [locked, setLocked] = useState(false);

  /**
   * Rotationen hänger ihop med hänglåset. I konsertläge ligger telefonen på
   * notstället och får gärna ligga ner; medan man arbetar i appen är en skärm
   * som kastar om sig bara i vägen. Vad som gäller när avgörs i inställningen.
   */
  useEffect(() => {
    void ställRotation(fårVridas(settings.rotation, locked));
  }, [settings.rotation, locked]);

  const openTab = (id: Tab) => {
    if (!locked) {
      setTab(id);
    }
  };

  const lock = () => {
    setLocked(true);
    setTab('songs');
  };

  return (
    <>
      {/* Ljusa teman behöver mörk statusradstext, annars försvinner klockan. */}
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.body}>
          {tab === 'play' ? <PlayScreen onOpenSongs={() => openTab('songs')} /> : null}
          {tab === 'songs' ? (
            <SongsScreen
              onOpenPlay={() => openTab('play')}
              locked={locked}
              onLock={lock}
            />
          ) : null}
          {tab === 'settings' ? <SettingsScreen /> : null}
        </View>

        {/* Låset flyter över innehållet så att det syns var man än rullat. */}
        {locked ? (
          <View style={styles.lockBadge}>
            <LockGlyph color={t.accent} />
          </View>
        ) : null}

        {locked ? (
          <UnlockBar onUnlock={() => setLocked(false)} />
        ) : (
        <View style={styles.tabBar}>
          {TABS.map(({ id, label, symbol, icon, compact }) => {
            const active = tab === id;
            // Med en laddad låt redigerar spelvyn den låten i stället för att
            // skapa en ny — pennan på papperet säger det, plusset skulle ljuga.
            const shownIcon =
              id === 'play' && currentSong
                ? (color: string) => <EditIcon color={color} />
                : icon;
            return (
              <Pressable
                key={id}
                onPress={() => openTab(id)}
                style={[
                  styles.tab,
                  compact && styles.tabCompact,
                  active && styles.tabActive,
                ]}
              >
                {shownIcon ? (
                  shownIcon(active ? t.onAccent : t.textMuted)
                ) : (
                  <Text
                    style={[
                      styles.tabLabel,
                      symbol && styles.tabSymbol,
                      active && styles.tabLabelActive,
                    ]}
                  >
                    {label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
        )}
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
  lockBadge: {
    position: 'absolute',
    // Märket är en upplysning, inte en knapp: tryck går igenom det.
    pointerEvents: 'none',
    top: spacing.sm,
    right: spacing.md,
    backgroundColor: t.surfaceRaised,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: radius.pill,
    padding: 9,
    // Utan lyft glider listan över märket i stället för under det.
    zIndex: 10,
    elevation: 4,
  },
  // Kugghjulet delar inte raden med de andra — en liten knapp till höger
  // räcker för något man sällan öppnar.
  tabCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    paddingHorizontal: spacing.md,
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
