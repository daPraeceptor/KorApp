/**
 * Snurrhjul för tempo.
 *
 * Hjulet vrids med fingret runt mitten. Vridningen räknas relativt, så att
 * fingret aldrig "hoppar" till en ny position, och visaren visar samtidigt
 * var i hela tempoområdet man befinner sig.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { MAX_BPM, MIN_BPM, clampBpm } from '../audio/tempo';
import { Palette, radius } from '../theme';
import { useTheme, useThemedStyles } from '../ThemeContext';

/** Gradtal per steg om ett slag per minut. En helt varv motsvarar ca 144 bpm. */
const DEGREES_PER_BPM = 2.5;

/** Visarens område: 270 grader, med öppningen nedåt. */
const SWEEP = 270;
const START_ANGLE = -135;

interface Props {
  bpm: number;
  onChange: (bpm: number) => void;
  size?: number;
  /** Taktdel som just nu hörs, för blinket i mitten. Null när metronomen är stoppad. */
  activeBeat?: number | null;
  beatsPerBar?: number;
  /** Anropas när greppet tas och släpps, så att vyn kan låsa sin scroll. */
  onDraggingChange?: (dragging: boolean) => void;
}

/** Punkt på cirkeln där 0 grader är rakt upp och positiva grader går medsols. */
function polar(cx: number, cy: number, r: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const start = polar(cx, cy, r, from);
  const end = polar(cx, cy, r, to);
  const largeArc = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function angleForBpm(bpm: number): number {
  const ratio = (bpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
  return START_ANGLE + ratio * SWEEP;
}

/** Kortaste vinkelskillnaden, så att passagen förbi toppen inte ger ett skutt. */
function shortestDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/**
 * På webben tolkar webbläsaren annars dragningen som en sidscroll och rullar
 * sidan samtidigt som hjulet vrids. touchAction stänger av det för just hjulet,
 * och userSelect hindrar att texten i mitten markeras när man drar med musen.
 *
 * Egenskaperna finns bara i react-native-web, därför typkonverteringen.
 */
const WEB_GESTURE_STYLE =
  Platform.OS === 'web'
    ? ({ touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle)
    : undefined;

export function TempoWheel({
  bpm,
  onChange,
  size = 260,
  activeBeat = null,
  beatsPerBar = 4,
  onDraggingChange,
}: Props) {
  const wheelRef = useRef<View>(null);
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const center = useRef({ x: 0, y: 0 });
  const lastAngle = useRef(0);
  /**
   * Mätningen av hjulets mittpunkt är asynkron och hinner inte bli klar innan
   * greppet tas. Därför sätts utgångsvinkeln först vid den första rörelsen,
   * när mittpunkten säkert är känd.
   */
  const needsBaseline = useRef(true);
  const preciseBpm = useRef(bpm);
  const bpmRef = useRef(bpm);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    bpmRef.current = bpm;
    // Håll det exakta värdet i takt med värden som satts utifrån, t.ex. vid låtbyte.
    if (Math.round(preciseBpm.current) !== bpm) {
      preciseBpm.current = bpm;
    }
  }, [bpm]);

  const measure = useCallback(() => {
    wheelRef.current?.measureInWindow((x, y, width, height) => {
      center.current = { x: x + width / 2, y: y + height / 2 };
    });
  }, []);

  const angleFromTouch = useCallback((pageX: number, pageY: number) => {
    const dx = pageX - center.current.x;
    const dy = pageY - center.current.y;
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          measure();
          needsBaseline.current = true;
          preciseBpm.current = bpmRef.current;
          setDragging(true);
          onDraggingChange?.(true);
        },
        onPanResponderMove: (_event, gesture) => {
          const angle = angleFromTouch(gesture.moveX, gesture.moveY);

          if (needsBaseline.current) {
            needsBaseline.current = false;
            lastAngle.current = angle;
            return;
          }

          const delta = shortestDelta(lastAngle.current, angle);
          lastAngle.current = angle;

          preciseBpm.current = Math.min(
            MAX_BPM,
            Math.max(MIN_BPM, preciseBpm.current + delta / DEGREES_PER_BPM),
          );

          const next = clampBpm(preciseBpm.current);
          if (next !== bpmRef.current) {
            bpmRef.current = next;
            if (Platform.OS !== 'web') {
              void Haptics.selectionAsync().catch(() => {});
            }
            onChange(next);
          }
        },
        onPanResponderRelease: () => {
          setDragging(false);
          onDraggingChange?.(false);
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          onDraggingChange?.(false);
        },
      }),
    [angleFromTouch, measure, onChange, onDraggingChange],
  );

  const cx = size / 2;
  const cy = size / 2;
  const trackRadius = size / 2 - 18;
  const knobRadius = size / 2 - 46;
  const needleAngle = angleForBpm(bpm);

  const ticks = useMemo(() => {
    const result: { angle: number; major: boolean }[] = [];
    for (let value = MIN_BPM; value <= MAX_BPM; value += 10) {
      result.push({ angle: angleForBpm(value), major: value % 60 === 0 });
    }
    return result;
  }, []);

  const beatDots = useMemo(
    () => Array.from({ length: Math.min(beatsPerBar, 12) }, (_, index) => index),
    [beatsPerBar],
  );

  return (
    <View
      ref={wheelRef}
      onLayout={measure}
      style={[styles.container, { width: size, height: size }, WEB_GESTURE_STYLE]}
      {...panResponder.panHandlers}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={knobRadius}
          fill={t.surfaceRaised}
          stroke={dragging ? t.accent : t.border}
          strokeWidth={dragging ? 3 : 2}
        />

        <Path
          d={arcPath(cx, cy, trackRadius, START_ANGLE, START_ANGLE + SWEEP)}
          stroke={t.border}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={arcPath(cx, cy, trackRadius, START_ANGLE, needleAngle)}
          stroke={t.accent}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />

        {ticks.map(({ angle, major }, index) => {
          const outer = polar(cx, cy, trackRadius - 9, angle);
          const inner = polar(cx, cy, trackRadius - (major ? 20 : 15), angle);
          return (
            <Line
              key={index}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={major ? t.textMuted : t.border}
              strokeWidth={major ? 2 : 1}
            />
          );
        })}

        <G>
          {(() => {
            const grip = polar(cx, cy, knobRadius - 14, needleAngle);
            return <Circle cx={grip.x} cy={grip.y} r={7} fill={t.accent} />;
          })()}
        </G>
      </Svg>

      <View style={styles.readout} pointerEvents="none">
        <Text style={styles.bpm}>{bpm}</Text>
        <Text style={styles.unit}>slag/min</Text>
        <View style={styles.beats}>
          {beatDots.map((index) => (
            <View
              key={index}
              style={[
                styles.beatDot,
                index === 0 && styles.beatDotFirst,
                activeBeat === index && styles.beatDotActive,
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  readout: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bpm: {
    color: t.text,
    fontSize: 64,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 68,
  },
  unit: {
    color: t.textMuted,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  beats: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    height: 10,
  },
  beatDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: t.border,
  },
  beatDotFirst: {
    backgroundColor: t.surfaceRaised,
    borderWidth: 1,
    borderColor: t.textMuted,
  },
  beatDotActive: {
    backgroundColor: t.accent,
    transform: [{ scale: 1.3 }],
  },
});
