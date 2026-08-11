/**
 * Varning när telefonens egen ljudnivå är nerskruvad.
 *
 * Den vanligaste förvirringen med appen är att den «inte låter» fast allt är
 * rätt inställt: appens egen volym står högt, men telefonen är nerskruvad
 * sedan gudstjänsten. Remsan säger vad som är fel och var man vrider.
 *
 * Den visas bara när nivån är känd. iOS berättar sin ljudnivå först när
 * någon rör knapparna, så tystnad här betyder «vet inte», inte «allt bra».
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../state/AppState';
import { Palette, radius, spacing } from '../theme';
import { useThemedStyles } from '../ThemeContext';

/** Under den här nivån hörs appen knappt ens i ett tyst rum. */
const LÅG_NIVÅ = 0.2;

export function VolumeNotice() {
  const styles = useThemedStyles(makeStyles);
  const { systemVolume } = useAppState();

  if (systemVolume === null || systemVolume >= LÅG_NIVÅ) {
    return null;
  }

  return (
    <View style={styles.notice}>
      <Text style={styles.title}>
        {systemVolume <= 0.001
          ? 'Telefonens ljud är avstängt'
          : 'Telefonens volym är nästan avstängd'}
      </Text>
      <Text style={styles.text}>
        Höj med knapparna på telefonens sida. Appens egen volym i
        inställningarna ligger ovanpå den här nivån.
      </Text>
    </View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    notice: {
      backgroundColor: t.accentSurface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.accent,
      padding: spacing.md,
      gap: 4,
    },
    title: {
      color: t.text,
      fontSize: 15,
      fontWeight: '700',
    },
    text: {
      color: t.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
