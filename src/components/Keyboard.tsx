/**
 * Klaviatur för att ge kören toner.
 *
 * Ett tryck spelar tonen. Ett dubbeltryck gör tangenten till tonika, det vill
 * säga referenstonen som den rena stämningen räknas ifrån — tangenten markeras
 * då tydligt så att man ser vad kören stämmer mot.
 *
 * Tonikan sätts medvetet inte med långtryck: att hålla ned en tangent är precis
 * vad man gör för att låta kören höra en ton, och det ska inte byta referens.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { audioEngine } from '../audio/engine';
import {
  LabelConfig,
  TuningConfig,
  frequencyOf,
  isBlackKey,
  isLabelRoot,
  noteLabel,
  octaveOf,
  pitchClass,
} from '../theory/tuning';
import { colors, radius } from '../theme';

const WHITE_KEY_WIDTH = 52;
const WHITE_KEY_HEIGHT = 184;
const BLACK_KEY_WIDTH = 34;
const BLACK_KEY_HEIGHT = 116;

/** Längsta tiden mellan två tryck för att de ska räknas som ett dubbeltryck. */
const DOUBLE_TAP_MS = 350;

interface Props {
  /** Lägsta och högsta MIDI-ton som visas. */
  fromMidi: number;
  toMidi: number;
  tuning: TuningConfig;
  labels: LabelConfig;
  /** När falskt lämnas tangenterna omärkta. */
  showLabels: boolean;
  /** MIDI-toner som är sparade till låten. */
  selectedTones: number[];
  /** När sant lägger ett tryck också till eller tar bort tonen ur låten. */
  selectMode: boolean;
  onSetTonic: (pitchClass: number) => void;
  onToggleTone: (midi: number) => void;
  /** Anropas med tonen som spelas, och med null när den släpps. */
  onNotePlayed?: (midi: number | null) => void;
}

export function Keyboard({
  fromMidi,
  toMidi,
  tuning,
  labels,
  showLabels,
  selectedTones,
  selectMode,
  onSetTonic,
  onToggleTone,
  onNotePlayed,
}: Props) {
  const [pressed, setPressed] = useState<number[]>([]);
  const lastTap = useRef<{ midi: number; at: number } | null>(null);

  const { whiteKeys, blackKeys } = useMemo(() => {
    const whites: number[] = [];
    for (let midi = fromMidi; midi <= toMidi; midi += 1) {
      if (!isBlackKey(midi)) {
        whites.push(midi);
      }
    }
    // Varje svart tangent placeras i skarven efter den vita tangent den följer.
    const blacks: { midi: number; whiteIndex: number }[] = [];
    whites.forEach((midi, index) => {
      const candidate = midi + 1;
      if (candidate <= toMidi && isBlackKey(candidate)) {
        blacks.push({ midi: candidate, whiteIndex: index });
      }
    });
    return { whiteKeys: whites, blackKeys: blacks };
  }, [fromMidi, toMidi]);

  const setTonic = useCallback(
    (midi: number) => {
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      onSetTonic(pitchClass(midi));
    },
    [onSetTonic],
  );

  const press = useCallback(
    async (midi: number) => {
      const now = Date.now();
      const previous = lastTap.current;
      if (previous && previous.midi === midi && now - previous.at < DOUBLE_TAP_MS) {
        setTonic(midi);
        lastTap.current = null;
      } else {
        lastTap.current = { midi, at: now };
      }

      setPressed((current) => [...current, midi]);
      onNotePlayed?.(midi);
      await audioEngine.ensure();
      audioEngine.startVoice(`key-${midi}`, frequencyOf(midi, tuning));
      if (selectMode) {
        onToggleTone(midi);
      }
    },
    [onNotePlayed, onToggleTone, selectMode, setTonic, tuning],
  );

  const release = useCallback(
    (midi: number) => {
      setPressed((current) => current.filter((value) => value !== midi));
      audioEngine.stopVoice(`key-${midi}`);
      onNotePlayed?.(null);
    },
    [onNotePlayed],
  );

  // Tonikan märks ut när den betyder något: som referens för den rena
  // stämningen, eller som utgångspunkt för solmisation och tonplatser.
  const tonicMatters =
    tuning.system === 'just' ||
    (labels.system !== 'letters' && labels.reference === 'tonic');

  const isTonic = (midi: number) =>
    tonicMatters && pitchClass(midi) === tuning.tonicPitchClass;

  const renderLabel = (midi: number, black: boolean) => {
    if (!showLabels) {
      return null;
    }
    const name = noteLabel(midi, labels);
    // Oktavsiffran sätts ut på systemets utgångston, så att man hittar läget.
    // Utom för tonplatser: «I3» läses lätt som ett tal i stället för första
    // tonplatsen i tredje oktaven.
    const showOctave = labels.system !== 'degrees' && isLabelRoot(midi, labels);
    return (
      <Text
        numberOfLines={1}
        style={[styles.label, black ? styles.labelBlack : styles.labelWhite]}
      >
        {showOctave ? `${name}${octaveOf(midi)}` : name}
      </Text>
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.keyboard, { width: whiteKeys.length * WHITE_KEY_WIDTH }]}>
        {whiteKeys.map((midi) => {
          const active = pressed.includes(midi);
          const tonic = isTonic(midi);
          const saved = selectedTones.includes(midi);
          return (
            <Pressable
              key={midi}
              onPressIn={() => void press(midi)}
              onPressOut={() => release(midi)}
              style={[
                styles.whiteKey,
                active && styles.whiteKeyPressed,
                tonic && styles.tonicKey,
              ]}
            >
              <View style={styles.markers}>
                {saved ? <View style={styles.savedDot} /> : null}
              </View>
              <View style={styles.keyFoot}>
                {tonic ? (
                  <Text style={styles.tonicBadge} numberOfLines={1}>
                    TONIKA
                  </Text>
                ) : null}
                {renderLabel(midi, false)}
              </View>
            </Pressable>
          );
        })}

        {blackKeys.map(({ midi, whiteIndex }) => {
          const active = pressed.includes(midi);
          const tonic = isTonic(midi);
          const saved = selectedTones.includes(midi);
          return (
            <Pressable
              key={midi}
              onPressIn={() => void press(midi)}
              onPressOut={() => release(midi)}
              style={[
                styles.blackKey,
                {
                  left:
                    (whiteIndex + 1) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2,
                },
                active && styles.blackKeyPressed,
                tonic && styles.tonicKeyBlack,
              ]}
            >
              <View style={styles.markers}>
                {saved ? <View style={styles.savedDot} /> : null}
              </View>
              <View style={styles.keyFoot}>
                {tonic ? (
                  <Text style={styles.tonicBadgeBlack} numberOfLines={1}>
                    TON
                  </Text>
                ) : null}
                {renderLabel(midi, true)}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 2,
  },
  keyboard: {
    height: WHITE_KEY_HEIGHT,
    flexDirection: 'row',
    position: 'relative',
  },
  whiteKey: {
    width: WHITE_KEY_WIDTH,
    height: WHITE_KEY_HEIGHT,
    backgroundColor: colors.keyWhite,
    borderWidth: 1,
    borderColor: '#b9b9c8',
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  whiteKeyPressed: {
    backgroundColor: colors.keyWhitePressed,
  },
  blackKey: {
    position: 'absolute',
    top: 0,
    width: BLACK_KEY_WIDTH,
    height: BLACK_KEY_HEIGHT,
    backgroundColor: colors.keyBlack,
    borderWidth: 1,
    borderColor: '#0c0c14',
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  blackKeyPressed: {
    backgroundColor: colors.keyBlackPressed,
  },
  tonicKey: {
    backgroundColor: colors.pure,
    borderColor: '#2f9c78',
  },
  tonicKeyBlack: {
    backgroundColor: '#1f7a5e',
    borderColor: colors.pure,
  },
  markers: {
    alignItems: 'center',
    gap: 3,
    minHeight: 10,
  },
  savedDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.tone,
  },
  /**
   * Nedre delen av tangenten. Tonika-etiketten hör hemma här och inte högre
   * upp, eftersom de svarta tangenterna täcker den övre halvan av de vita.
   */
  keyFoot: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 3,
  },
  tonicBadge: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#0d3b2e',
    backgroundColor: '#a8f0d4',
    paddingVertical: 1,
  },
  tonicBadgeBlack: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 7,
    fontWeight: '800',
    color: '#0d3b2e',
    backgroundColor: colors.pure,
    paddingVertical: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  labelWhite: {
    color: colors.keyLabel,
  },
  labelBlack: {
    color: '#b9b9c8',
  },
});
