/**
 * Klaviatur för att ge kören toner.
 *
 * Ett tryck spelar tonen. Ett dubbeltryck gör tangenten till grundton, det vill
 * säga referenstonen som den rena stämningen räknas ifrån — tangenten markeras
 * då tydligt så att man ser vad kören stämmer mot.
 *
 * Grundtonen sätts medvetet inte med långtryck: att hålla ned en tangent är precis
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
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { haptik } from '../haptics';
import {
  BLACK_KEY_HEIGHT,
  BLACK_KEY_WIDTH,
  WHITE_KEY_HEIGHT,
  WHITE_KEY_WIDTH,
  klaviaturmått,
} from './klaviaturmatt.ts';

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
import { Palette, radius } from '../theme';
import { useTheme, useThemedStyles } from '../ThemeContext';



/** Längsta tiden mellan två tryck för att de ska räknas som ett dubbeltryck. */
const DOUBLE_TAP_MS = 350;

/**
 * Pricken som märker ut låtens sparade toner. Måste synas på de smala svarta
 * tangenterna också, som bara är 34 enheter breda.
 */
const SAVED_DOT = 14;

/**
 * På webben markeras annars tonnamnen som text när man drar över tangenterna.
 * Tangenter är knappar, inte text att markera.
 *
 * touchAction lämnas med flit orörd — klaviaturen ligger i en horisontell
 * rullningsvy som måste gå att dra i sidled.
 *
 * Egenskapen finns bara i react-native-web, därför typkonverteringen. Prefixade
 * varianter är meningslösa här: react-native-web släpper igenom userSelect men
 * slänger WebkitUserSelect och WebkitTouchCallout.
 */
const WEB_NO_SELECT =
  Platform.OS === 'web'
    ? ({ userSelect: 'none' } as unknown as ViewStyle)
    : undefined;

interface Props {
  /** Lägsta och högsta MIDI-ton som visas. */
  fromMidi: number;
  toMidi: number;
  tuning: TuningConfig;
  labels: LabelConfig;
  /** När falskt lämnas tangenterna omärkta. */
  showLabels: boolean;
  /** Om grundtonstangenten ska markeras med etikett och färg. */
  markTonic: boolean;
  /** MIDI-toner som är sparade till låten. */
  selectedTones: number[];
  /** När sant lägger ett tryck också till eller tar bort tonen ur låten. */
  selectMode: boolean;
  onSetTonic: (pitchClass: number) => void;
  onToggleTone: (midi: number) => void;
  /** Anropas med tonen som spelas, och med null när den släpps. */
  onNotePlayed?: (midi: number | null) => void;
  /**
   * Om satt går bara de här tonerna att spela — resten dämpas och tiger.
   * Klaviaturen blir då ren uppspelning: varken grundton eller tonval går
   * att ändra från den.
   */
  playableTones?: number[];
  /**
   * Breddar tangenterna så att klaviaturen fyller sin yta kant till kant
   * när tonspannet är litet. Är spannet bredare än ytan rullar den i
   * sidled som vanligt.
   */
  fillWidth?: boolean;
}

export function Keyboard({
  fromMidi,
  toMidi,
  tuning,
  labels,
  showLabels,
  markTonic,
  selectedTones,
  selectMode,
  onSetTonic,
  onToggleTone,
  onNotePlayed,
  playableTones,
  fillWidth = false,
}: Props) {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Skärmhöjden avgör hur hög klaviaturen får bli. I liggande läge är det
  // höjden som tar slut först.
  const { height: fönsterhöjd } = useWindowDimensions();
  const [pressed, setPressed] = useState<number[]>([]);
  const lastTap = useRef<{ midi: number; at: number } | null>(null);
  /** Ytans bredd, mätt för att kunna breddas kant till kant. */
  const [containerWidth, setContainerWidth] = useState(0);

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
      haptik.medel();
      onSetTonic(pitchClass(midi));
    },
    [onSetTonic],
  );

  const press = useCallback(
    async (midi: number) => {
      // I uppspelningsläget tiger allt utom de förvalda tonerna, och varken
      // grundton eller tonval går att röra.
      if (playableTones) {
        if (!playableTones.includes(midi)) {
          return;
        }
        setPressed((current) => [...current, midi]);
        onNotePlayed?.(midi);
        await audioEngine.ensure();
        audioEngine.startVoice(`key-${midi}`, frequencyOf(midi, tuning));
        return;
      }

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
    [onNotePlayed, onToggleTone, playableTones, selectMode, setTonic, tuning],
  );

  const release = useCallback(
    (midi: number) => {
      setPressed((current) => current.filter((value) => value !== midi));
      audioEngine.stopVoice(`key-${midi}`);
      onNotePlayed?.(null);
    },
    [onNotePlayed],
  );

  /**
   * I uppspelningsläget färgas ingen tangent, oavsett vad anroparen ber om.
   * Klaviaturen ska läsas som ett piano: vita och svarta tangenter, och
   * tonerna utpekade med prickar i stället för med kulör.
   */
  const isTonic = (midi: number) =>
    !playableTones && markTonic && pitchClass(midi) === tuning.tonicPitchClass;

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

  // Kant till kant: tangenterna breddas tills klaviaturen fyller ytan, men
  // bara så länge formen bär. Är spannet bredare än ytan rullar den i sidled.
  const {
    tangentbredd: keyWidth,
    tangenthöjd: keyHeight,
    svartbredd: blackWidth,
    svarthöjd: blackHeight,
  } = klaviaturmått(containerWidth, whiteKeys.length, fönsterhöjd, fillWidth);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <View
        style={[
          styles.keyboard,
          { width: whiteKeys.length * keyWidth, height: keyHeight },
          WEB_NO_SELECT,
        ]}
      >
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
                { width: keyWidth, height: keyHeight },
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
                    GRUNDTON
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
                  left: (whiteIndex + 1) * keyWidth - blackWidth / 2,
                  width: blackWidth,
                  height: blackHeight,
                },
                active && styles.blackKeyPressed,
                tonic && styles.tonicKeyBlack,
              ]}
            >
              <View style={styles.markers}>
                {saved ? <View style={styles.savedDot} /> : null}
              </View>
              <View style={styles.keyFoot}>
                {/* Förkortat: en svart tangent är bara 34 enheter bred. */}
                {tonic ? (
                  <Text style={styles.tonicBadgeBlack} numberOfLines={1}>
                    GRUND
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

const makeStyles = (t: Palette) => StyleSheet.create({
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
    backgroundColor: t.keyWhite,
    borderWidth: 1,
    borderColor: t.keyWhiteBorder,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  whiteKeyPressed: {
    backgroundColor: t.keyWhitePressed,
  },
  blackKey: {
    position: 'absolute',
    top: 0,
    width: BLACK_KEY_WIDTH,
    height: BLACK_KEY_HEIGHT,
    backgroundColor: t.keyBlack,
    borderWidth: 1,
    borderColor: t.keyBlackBorder,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  blackKeyPressed: {
    backgroundColor: t.keyBlackPressed,
  },
  tonicKey: {
    backgroundColor: t.pure,
    borderColor: t.tonicBorder,
  },
  tonicKeyBlack: {
    backgroundColor: t.tonicBlackBg,
    borderColor: t.pure,
  },
  /**
   * Prickens plats högst upp på tangenten. Höjden är exakt prickens, annars
   * sitter den snett i sitt eget utrymme. Bredden sträcks över tangenten så
   * att centreringen räknas mot tangentens mitt och inte mot prickens.
   */
  markers: {
    alignSelf: 'stretch',
    alignItems: 'center',
    height: SAVED_DOT,
  },
  savedDot: {
    width: SAVED_DOT,
    height: SAVED_DOT,
    borderRadius: radius.pill,
    backgroundColor: t.tone,
  },
  /**
   * Nedre delen av tangenten. Grundtons-etiketten hör hemma här och inte högre
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
    color: t.onPure,
    backgroundColor: t.tonicBadgeBg,
    paddingVertical: 1,
  },
  tonicBadgeBlack: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 7,
    fontWeight: '800',
    color: t.onPure,
    backgroundColor: t.pure,
    paddingVertical: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  labelWhite: {
    color: t.keyLabel,
  },
  labelBlack: {
    color: t.keyLabelBlack,
  },
});
