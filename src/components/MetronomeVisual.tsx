/**
 * Grafisk taktvisare.
 *
 * Animeringen räknas ut från när taktslaget faktiskt hördes, inte från en egen
 * timer. Därför följer bilden ljudet även om appen hackar till, i stället för
 * att glida ur fas med det man hör.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { beatPosition } from '../audio/beatPosition';
import { BeatPulse, MetronomeVisualStyle } from '../state/AppState';
import { Palette, radius } from '../theme';
import { useTheme, useThemedStyles } from '../ThemeContext';

const HEIGHT = 150;

/** Pendelns utslag åt vardera hållet. */
const SWING_DEGREES = 28;

/** Bollens studshöjd vid långsammast respektive snabbast tempo. */
const BOUNCE_MIN = 42;
const BOUNCE_MAX = 108;
const BOUNCE_SLOW_BPM = 40;
const BOUNCE_FAST_BPM = 200;

interface Props {
  style: MetronomeVisualStyle;
  running: boolean;
  bpm: number;
  pulse: BeatPulse | null;
  /** Taktdel som just hörs, för att markera ettan. */
  activeBeat: number | null;
  /**
   * Sant när takten visas utan ljud. Då finns inga klick att följa, och
   * bilden går på egen klocka.
   *
   * Med ljud men utan klick ännu — de första millisekunderna efter start —
   * står visaren still i utgångsläget i stället. En egen klocka där skulle
   * börja mitt i en svängning och sedan hoppa till noll när första klicket
   * kom, vilket syns som en blink.
   */
  silent?: boolean;
}

/**
 * Studshöjden följer tempot: långsamma tempon ger högre studs, snabba lägre,
 * så att bollen hinner se ut att falla i stället för att fladdra.
 */
function bounceHeight(bpm: number): number {
  const span = BOUNCE_FAST_BPM - BOUNCE_SLOW_BPM;
  const andel = Math.min(Math.max((BOUNCE_FAST_BPM - bpm) / span, 0), 1);
  return BOUNCE_MIN + andel * (BOUNCE_MAX - BOUNCE_MIN);
}

export function MetronomeVisual({
  style,
  running,
  bpm,
  pulse,
  activeBeat,
  silent = false,
}: Props) {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [, setFrame] = useState(0);

  useEffect(() => {
    if (!running || style === 'none') {
      return;
    }
    let id: number;
    const rita = () => {
      setFrame((n) => n + 1);
      id = requestAnimationFrame(rita);
    };
    id = requestAnimationFrame(rita);
    return () => cancelAnimationFrame(id);
  }, [running, style]);

  if (style === 'none') {
    return null;
  }

  const { phase, direction } = beatPosition(running, pulse, bpm, silent, Date.now());
  const onBeat = activeBeat === 0;

  if (style === 'ball') {
    const height = bounceHeight(bpm);
    // Parabel: bollen är nere vid taktslaget och högst mitt emellan.
    const lift = running ? height * 4 * phase * (1 - phase) : 0;
    return (
      <View style={styles.container}>
        <View style={styles.ballArea}>
          <View style={[styles.ball, onBeat && styles.ballAccent, { bottom: lift }]} />
        </View>
        <View style={styles.ground} />
      </View>
    );
  }

  if (style === 'bar') {
    // Linjär färd från kant till kant, med vändning exakt på slaget — som
    // bollen i gamla tv-spel, inte som en pendel som saktar in mot kanterna.
    //
    // Läget anges i procent av banan i stället för uppmätta pixlar: den gamla
    // mätningen via onLayout kunde bli stående på noll, och då stod markören
    // blickstilla mitt på banan oavsett takt.
    const andel = running ? direction * (2 * phase - 1) : 0;
    return (
      <View style={styles.container}>
        <View style={styles.track} />
        <View
          style={[
            styles.marker,
            onBeat && styles.markerAccent,
            { left: `${50 + andel * 44}%` },
          ]}
        />
      </View>
    );
  }

  // Pendel: vinkeln går mjukt mellan ytterlägena, med vändning precis på slaget.
  const angle = running ? direction * SWING_DEGREES * Math.cos(Math.PI * phase) : 0;
  const pivotX = 100;
  const pivotY = 132;
  const rodLength = 104;
  const weightAt = 58;

  return (
    <View style={styles.container}>
      <Svg width="100%" height={HEIGHT} viewBox="0 0 200 150">
        <Path
          d="M74 140 L96 30 L104 30 L126 140 Z"
          fill={t.surfaceRaised}
          stroke={t.border}
          strokeWidth={2}
        />
        <G transform={`rotate(${angle} ${pivotX} ${pivotY})`}>
          <Line
            x1={pivotX}
            y1={pivotY}
            x2={pivotX}
            y2={pivotY - rodLength}
            stroke={t.accent}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Circle
            cx={pivotX}
            cy={pivotY - weightAt}
            r={11}
            fill={onBeat ? t.accent : t.surfaceRaised}
            stroke={t.accent}
            strokeWidth={3}
          />
        </G>
        <Circle cx={pivotX} cy={pivotY} r={5} fill={t.border} />
      </Svg>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: {
    height: HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  ballArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  ball: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: t.accent,
  },
  ballAccent: {
    backgroundColor: t.pure,
  },
  ground: {
    height: 3,
    width: '70%',
    borderRadius: radius.pill,
    backgroundColor: t.border,
    marginBottom: 18,
  },
  track: {
    position: 'absolute',
    top: HEIGHT / 2,
    height: 3,
    width: '90%',
    borderRadius: radius.pill,
    backgroundColor: t.border,
  },
  marker: {
    position: 'absolute',
    top: HEIGHT / 2 - 26,
    width: 8,
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: t.accent,
    // Procentläget pekar på markörens vänsterkant — halva bredden tillbaka
    // ställer mittlinjen på rätt punkt.
    marginLeft: -4,
  },
  markerAccent: {
    backgroundColor: t.pure,
  },
});
