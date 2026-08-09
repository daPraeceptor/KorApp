/** Små återanvändbara byggstenar för appens vyer. */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTheme } from '../ThemeContext';
import { Palette, ThemeId, radius, spacing } from '../theme';

/**
 * Stilarna cachas per tema. Appen ritar dussintals knappar, och utan cachen
 * skulle var och en bygga en egen identisk uppsättning vid varje omritning.
 */
const stilCache = new Map<ThemeId, ReturnType<typeof makeStyles>>();
const variantCache = new Map<ThemeId, ReturnType<typeof makeVariants>>();
const etikettCache = new Map<ThemeId, ReturnType<typeof makeVariantLabels>>();

function hämta<V>(cache: Map<ThemeId, V>, id: ThemeId, bygg: () => V): V {
  let värde = cache.get(id);
  if (!värde) {
    värde = bygg();
    cache.set(id, värde);
  }
  return värde;
}

function useStyles() {
  const t = useTheme();
  return {
    t,
    styles: hämta(stilCache, t.id, () => makeStyles(t)),
    variants: hämta(variantCache, t.id, () => makeVariants(t)),
    variantLabels: hämta(etikettCache, t.id, () => makeVariantLabels(t)),
  };
}

export function Card({
  children,
  style,
  onLayout,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Behövs av vyer som måste veta när kortet ändrar höjd. */
  onLayout?: (event: LayoutChangeEvent) => void;
  /**
   * Gör hela kortet tryckbart. Knappar inne i kortet tar sina egna tryck
   * som vanligt — bara ytan mellan dem faller igenom hit.
   */
  onPress?: () => void;
}) {
  const { styles } = useStyles();
  if (onPress) {
    return (
      <Pressable style={[styles.card, style]} onLayout={onLayout} onPress={onPress}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, style]} onLayout={onLayout}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const { styles } = useStyles();
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'default',
  disabled = false,
  style,
  renderIcon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'pure' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
  /** Ritas i stället för etiketten, i dess färg. Etiketten blir då bara namn. */
  renderIcon?: (color: string) => React.ReactNode;
}) {
  const { styles, variants, variantLabels } = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variants[variant],
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      {renderIcon ? (
        renderIcon(variantLabels[variant].color)
      ) : (
        <Text style={[styles.buttonLabel, variantLabels[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

export interface SegmentOption<T> {
  value: T;
  label: string;
  /**
   * Valfri bild ovanför etiketten, till exempel ett notvärde. Får färgen som
   * argument, eftersom den valda knappen har mörk text mot färgad botten.
   */
  renderIcon?: (color: string) => React.ReactNode;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  tint,
  compact = false,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Utan värde används temats accentfärg. */
  tint?: string;
  /** Krymper kontrollen till innehållets bredd i stället för att fylla raden. */
  compact?: boolean;
}) {
  const { t, styles } = useStyles();
  const färg = tint ?? t.accent;
  return (
    <View style={[styles.segmented, compact && styles.segmentedCompact]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              compact && styles.segmentCompact,
              selected && { backgroundColor: färg, borderColor: färg },
            ]}
          >
            {option.renderIcon
              ? option.renderIcon(selected ? t.onAccent : t.textMuted)
              : null}
            {/* Tom etikett hoppas över helt, annars tar den ändå plats i höjd. */}
            {option.label ? (
              // En etikett som inte får plats ska hellre synas avkortad än
              // brytas till en andra rad som klipps bort av knappens höjd.
              <Text
                numberOfLines={1}
                style={[
                  styles.segmentLabel,
                  selected && styles.segmentLabelSelected,
                ]}
              >
                {option.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
}) {
  const { styles } = useStyles();
  const change = (delta: number) =>
    onChange(Math.min(max, Math.max(min, value + delta)));
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => change(-step)}
        disabled={value <= min}
        style={({ pressed }) => [
          styles.stepperButton,
          pressed && styles.buttonPressed,
          value <= min && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.stepperSymbol}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{format ? format(value) : value}</Text>
      <Pressable
        onPress={() => change(step)}
        disabled={value >= max}
        style={({ pressed }) => [
          styles.stepperButton,
          pressed && styles.buttonPressed,
          value >= max && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.stepperSymbol}>+</Text>
      </Pressable>
    </View>
  );
}

/**
 * Webbläsaren tolkar annars dragningen som en sidscroll och rullar vyn medan
 * reglaget dras. Egenskaperna finns bara i react-native-web, därav konverteringen.
 */
const WEB_GESTURE_STYLE =
  Platform.OS === 'web'
    ? ({ touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle)
    : undefined;

/**
 * Skjutreglage för värden man vill kunna svepa igenom snabbt.
 *
 * Till skillnad från Stepper, som tar ett steg per tryck, går hela området att
 * dra igenom i en rörelse — och ett tryck var som helst på banan hoppar dit.
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const { t, styles } = useStyles();
  const trackRef = useRef<View>(null);
  /** Banans läge och bredd i fönstret, mätt när den ritats ut. */
  const geometry = useRef({ x: 0, width: 0 });
  const valueRef = useRef(value);
  valueRef.current = value;
  const [dragging, setDragging] = useState(false);

  const measure = useCallback((sedan?: () => void) => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      geometry.current = { x, width };
      sedan?.();
    });
  }, []);

  const valueAt = useCallback(
    (pageX: number) => {
      const { x, width } = geometry.current;
      if (width <= 0) {
        return valueRef.current;
      }
      const andel = Math.min(1, Math.max(0, (pageX - x) / width));
      const rått = min + andel * (max - min);
      return Math.min(max, Math.max(min, Math.round(rått / step) * step));
    },
    [min, max, step],
  );

  const panResponder = useMemo(() => {
    const flytta = (pageX: number) => {
      const next = valueAt(pageX);
      if (next !== valueRef.current) {
        valueRef.current = next;
        onChange(next);
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const { pageX } = event.nativeEvent;
        setDragging(true);
        // Mätningen är asynkron, så värdet sätts först när den kommit in.
        // Annars tappas det allra första trycket, medan banans mått ännu är noll.
        measure(() => flytta(pageX));
      },
      onPanResponderMove: (_event, gesture) => flytta(gesture.moveX),
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    });
  }, [measure, onChange, valueAt]);

  const andel = Math.min(1, Math.max(0, (value - min) / (max - min)));

  return (
    <View
      ref={trackRef}
      onLayout={() => measure()}
      style={[styles.sliderHit, WEB_GESTURE_STYLE]}
      {...panResponder.panHandlers}
    >
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${andel * 100}%` }]} />
      </View>
      <View
        style={[
          styles.sliderKnob,
          dragging && styles.sliderKnobActive,
          // Knappen centreras över sitt läge utan att kunna hamna utanför banan.
          { left: `${andel * 100}%`, marginLeft: -SLIDER_KNOB / 2 },
        ]}
        pointerEvents="none"
      >
        <View style={[styles.sliderKnobDot, { backgroundColor: t.accent }]} />
      </View>
    </View>
  );
}

const SLIDER_KNOB = 28;

/** Hänglås till draglåsen. */
export function LockGlyph({ color }: { color: string }) {
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

const SLIDE_KNOB_WIDTH = 64;

/**
 * Bekräftelse genom att dra hänglåset till högerkanten.
 *
 * Ett tryck räcker med flit inte: gesten ska tåla en tumme som råkar landa
 * på skärmen när telefonen ligger framme på notstället.
 */
export function SlideToConfirm({
  hint,
  onConfirm,
}: {
  hint: string;
  onConfirm: () => void;
}) {
  const { t, styles } = useStyles();
  const [dragX, setDragX] = useState(0);
  const trackWidth = useRef(0);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_event, gesture) => {
          const max = Math.max(0, trackWidth.current - SLIDE_KNOB_WIDTH - 6);
          setDragX(Math.min(max, Math.max(0, gesture.dx)));
        },
        onPanResponderRelease: (_event, gesture) => {
          const max = Math.max(0, trackWidth.current - SLIDE_KNOB_WIDTH - 6);
          // Nästan framme räknas som framme — men halvvägs gör det inte.
          if (max > 0 && gesture.dx >= max * 0.85) {
            onConfirm();
          }
          setDragX(0);
        },
        onPanResponderTerminate: () => setDragX(0),
      }),
    [onConfirm],
  );

  return (
    <View
      style={styles.slideTrack}
      onLayout={(e) => {
        trackWidth.current = e.nativeEvent.layout.width;
      }}
    >
      <Text style={styles.slideHint}>{hint}</Text>
      <View
        style={[styles.slideKnob, WEB_GESTURE_STYLE, { left: 3 + dragX }]}
        {...pan.panHandlers}
      >
        <LockGlyph color={t.onAccent} />
      </View>
    </View>
  );
}

/**
 * Stilarna byggs per palett i stället för en gång vid inladdning, annars fryses
 * färgerna som gällde när modulen laddades och temabytet slår aldrig igenom.
 */
const makeStyles = (t: Palette) => StyleSheet.create({
  card: {
    backgroundColor: t.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonLabel: {
    color: t.text,
    fontSize: 15,
    fontWeight: '600',
  },
  segmented: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segmentedCompact: {
    alignSelf: 'flex-start',
    // Kontrollen ger inte upp sin bredd när raden blir trång. Utan detta
    // pressades knapparna ihop på en telefon tills texten försvann.
    flexShrink: 0,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceRaised,
    alignItems: 'center',
  },
  segmentCompact: {
    // Inte flex: 0 — det ger grundbredd noll, så knappen krymper ihop och
    // texten rinner över kanten. Storleken ska följa innehållet.
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  segmentLabel: {
    color: t.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentLabelSelected: {
    color: t.onAccent,
  },
  slideTrack: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceRaised,
    justifyContent: 'center',
  },
  slideHint: {
    color: t.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingLeft: SLIDE_KNOB_WIDTH / 2,
  },
  slideKnob: {
    position: 'absolute',
    top: 3,
    width: SLIDE_KNOB_WIDTH,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: t.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Banan är tunn men greppytan hög, så att fingret träffar utan att sikta.
  sliderHit: {
    height: SLIDER_KNOB + 12,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: t.border,
    overflow: 'hidden',
  },
  sliderFill: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: t.accent,
  },
  sliderKnob: {
    position: 'absolute',
    width: SLIDER_KNOB,
    height: SLIDER_KNOB,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderKnobActive: {
    borderColor: t.accent,
    borderWidth: 2,
  },
  sliderKnobDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: {
    color: t.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  stepperValue: {
    color: t.text,
    fontSize: 17,
    fontWeight: '600',
    minWidth: 78,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});

const makeVariants = (t: Palette): Record<string, ViewStyle> => ({
  default: {},
  primary: { backgroundColor: t.accent, borderColor: t.accent },
  pure: { backgroundColor: t.pure, borderColor: t.pure },
  danger: { backgroundColor: 'transparent', borderColor: t.danger },
  ghost: { backgroundColor: 'transparent' },
});

const makeVariantLabels = (t: Palette): Record<string, { color: string }> => ({
  default: { color: t.text },
  primary: { color: t.onAccent },
  pure: { color: t.onPure },
  danger: { color: t.danger },
  ghost: { color: t.textMuted },
});
