/** Små återanvändbara byggstenar för appens vyer. */
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variantStyles[variant],
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, variantLabelStyles[variant]]}>{label}</Text>
    </Pressable>
  );
}

export interface SegmentOption<T> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  tint = colors.accent,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  tint?: string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              selected && { backgroundColor: tint, borderColor: tint },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                selected && styles.segmentLabelSelected,
              ]}
            >
              {option.label}
            </Text>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
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
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  segmented: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
  },
  segmentLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentLabelSelected: {
    color: '#12121a',
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  stepperValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    minWidth: 78,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});

const variantStyles: Record<string, ViewStyle> = {
  default: {},
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  pure: { backgroundColor: colors.pure, borderColor: colors.pure },
  danger: { backgroundColor: 'transparent', borderColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
};

const variantLabelStyles: Record<string, { color: string }> = {
  default: { color: colors.text },
  primary: { color: '#12121a' },
  pure: { color: '#0d3b2e' },
  danger: { color: colors.danger },
  ghost: { color: colors.textMuted },
};
