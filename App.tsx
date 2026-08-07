import React, { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { PlayScreen } from './src/screens/PlayScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SongsScreen } from './src/screens/SongsScreen';
import { AppStateProvider, useAppState } from './src/state/AppState';
import { Palette, radius, spacing } from './src/theme';
import { useTheme, useThemedStyles } from './src/ThemeContext';

type Tab = 'play' | 'songs' | 'settings';

/** Hänglås till upplåsningsdragaren. */
function LockIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={20} viewBox="0 0 18 20">
      <Path
        d="M5 9 V5.5 a4 4 0 0 1 8 0 V9"
        stroke={color}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
      />
      <Rect x={3} y={9} width={12} height={9} rx={2.2} fill={color} />
    </Svg>
  );
}

/** Webben tolkar annars draget som scroll eller textmarkering. */
const WEB_DRAG_STYLE =
  Platform.OS === 'web'
    ? ({ touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle)
    : undefined;

const UNLOCK_KNOB_WIDTH = 64;

/**
 * Upplåsning genom att dra låset till högerkanten.
 *
 * Ett tryck räcker med flit inte: i konsertläget ligger telefonen framme på
 * notstället, och låset ska tåla en tumme som råkar landa på skärmen.
 */
function UnlockBar({ onUnlock }: { onUnlock: () => void }) {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [dragX, setDragX] = useState(0);
  const trackWidth = useRef(0);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_event, gesture) => {
          const max = Math.max(0, trackWidth.current - UNLOCK_KNOB_WIDTH - 6);
          setDragX(Math.min(max, Math.max(0, gesture.dx)));
        },
        onPanResponderRelease: (_event, gesture) => {
          const max = Math.max(0, trackWidth.current - UNLOCK_KNOB_WIDTH - 6);
          // Nästan framme räknas som framme — men halvvägs gör det inte.
          if (max > 0 && gesture.dx >= max * 0.85) {
            onUnlock();
          }
          setDragX(0);
        },
        onPanResponderTerminate: () => setDragX(0),
      }),
    [onUnlock],
  );

  return (
    <View style={styles.tabBar}>
      <View
        style={styles.unlockTrack}
        onLayout={(e) => {
          trackWidth.current = e.nativeEvent.layout.width;
        }}
      >
        <Text style={styles.unlockHint}>Dra låset åt höger för att låsa upp</Text>
        <View
          style={[styles.unlockKnob, WEB_DRAG_STYLE, { left: 3 + dragX }]}
          {...pan.panHandlers}
        >
          <LockIcon color={t.onAccent} />
        </View>
      </View>
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
  const { currentSong } = useAppState();
  const [tab, setTab] = useState<Tab>('play');
  /**
   * Konsertläget låser appen till låtlistan och uppspelning. Låset sparas
   * med flit inte: en omstart låser upp, så att ingen blir kvar utestängd.
   */
  const [locked, setLocked] = useState(false);

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

        {locked ? (
          <UnlockBar onUnlock={() => setLocked(false)} />
        ) : (
        <View style={styles.tabBar}>
          {TABS.map(({ id, label, symbol, icon, compact }) => {
            const active = tab === id;
            // Med en laddad låt redigerar spelvyn den låten i stället för att
            // skapa en ny — pennan säger det, plusset skulle ljuga.
            const shownLabel =
              id === 'play' && currentSong ? '✎︎' : label;
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
                {icon ? (
                  icon(active ? t.onAccent : t.textMuted)
                ) : (
                  <Text
                    style={[
                      styles.tabLabel,
                      symbol && styles.tabSymbol,
                      active && styles.tabLabelActive,
                    ]}
                  >
                    {shownLabel}
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
  unlockTrack: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceRaised,
    justifyContent: 'center',
  },
  unlockHint: {
    color: t.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingLeft: UNLOCK_KNOB_WIDTH / 2,
  },
  unlockKnob: {
    position: 'absolute',
    top: 3,
    width: UNLOCK_KNOB_WIDTH,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: t.accent,
    alignItems: 'center',
    justifyContent: 'center',
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
