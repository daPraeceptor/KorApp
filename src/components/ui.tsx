/** Små återanvändbara byggstenar för appens vyer. */
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

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
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { styles } = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
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
}: {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'pure' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
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
      <Text style={[styles.buttonLabel, variantLabels[variant]]}>{label}</Text>
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
              <Text
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
