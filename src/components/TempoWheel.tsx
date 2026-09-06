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
import { haptik } from '../haptics';

import { MAX_BPM, MIN_BPM, clampBpm } from '../audio/tempo';
import { T } from '../i18n';
import { usePulse } from '../state/pulse';
import { Palette, radius } from '../theme';
import { useTheme, useThemedStyles } from '../ThemeContext';

/** Visarens område: 270 grader, med öppningen nedåt. */
const SWEEP = 270;
const START_ANGLE = -135;

/**
 * Gradtal per slag i minuten. Samma som visarens egen skala — 270 grader över
 * 270 slag — så att bågen och greppkulan följer fingret exakt 1:1: vrider man
 * fingret ett kvarts varv flyttar sig visaren ett kvarts varv.
 */
const DEGREES_PER_BPM = SWEEP / (MAX_BPM - MIN_BPM);

/**
 * Hjulets fulla storlek, och texten i mitten mätt vid den.
 *
 * Ett hjul som krympts för liggande läge eller en låg skärm ska krympa hela
 * vägen in: siffrorna satta i fast storlek svällde annars ut mot ringen och
 * la sig över taktprickarna under dem.
 */
const FULL_STORLEK = 260;
const BPM_TEXT = 64;
const BPM_RADHÖJD = 68;
const ENHET_TEXT = 13;
const TAKTPRICKAR_AVSTÅND = 10;

interface Props {
  bpm: number;
  onChange: (bpm: number) => void;
  size?: number;
  /**
   * Sant medan metronomen går. Hjulet prenumererar då på taktslagen själv,
   * för blinket i mitten — så att vyn omkring det slipper ritas om i takt.
   */
  running?: boolean;
  beatsPerBar?: number;
  /** Anropas när greppet tas och släpps, så att vyn kan låsa sin scroll. */
  onDraggingChange?: (dragging: boolean) => void;
  /** Ett stilla tryck mitt på siffrorna — startar och stoppar metronomen. */
  onCenterTap?: () => void;
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
  running = false,
  beatsPerBar = 4,
  onDraggingChange,
  onCenterTap,
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
  /** Var greppet togs, för att skilja ett tryck i mitten från en vridning. */
  const startPoint = useRef({ x: 0, y: 0 });
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
        onPanResponderGrant: (event) => {
          measure();
          needsBaseline.current = true;
          preciseBpm.current = bpmRef.current;
          startPoint.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          };
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
            haptik.val();
            onChange(next);
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          setDragging(false);
          onDraggingChange?.(false);
          // Ett stillastående tryck innanför ratten — inte ute vid skalan —
          // växlar metronomen. Vridningar lämnas i fred: har fingret rört
          // sig är det en tempoändring, inte ett tryck.
          if (onCenterTap && Math.hypot(gesture.dx, gesture.dy) < 8) {
            const dx = startPoint.current.x - center.current.x;
            const dy = startPoint.current.y - center.current.y;
            if (Math.hypot(dx, dy) < size / 2 - 46) {
              haptik.lätt();
              onCenterTap();
            }
          }
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          onDraggingChange?.(false);
        },
      }),
    [angleFromTouch, measure, onChange, onDraggingChange, onCenterTap, size],
  );

  // Bara prenumeration medan metronomen går: en stillastående metronom har
  // inga slag att blinka på, och då ska hjulet inte ritas om alls.
  const puls = usePulse(running);
  const aktivTaktdel = running && puls ? puls.beat : null;

  const cx = size / 2;
  const cy = size / 2;
  const trackRadius = size / 2 - 18;
  const knobRadius = size / 2 - 46;
  /** Skalstrecken: alla börjar strax innanför bågen, de hela minuttalen når längre in. */
  const tickOuter = trackRadius - 9;
  const tickInnerMajor = trackRadius - 20;
  const tickInnerMinor = trackRadius - 15;
  /**
   * Greppkulan ligger mitt på skalstrecken, inte inne på knoppen. Det är
   * strecken den pekar ut, och inne på knoppen låg den för långt från både
   * bågen och skalan för att gå att läsa av mot dem.
   */
  const gripRadius = (tickOuter + tickInnerMajor) / 2;
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

  /**
   * Punkterna får bara det utrymme knoppen faktiskt har. Vid fyra slag ryms
   * standardstorleken (8/6) gott och väl, så formeln landar exakt där — men
   * vid tolv, eller på ett hjul som krympts för liggande läge, är det för
   * trångt, och då krymper både prickar och mellanrum tillsammans i stället
   * för att rada ut sig utanför ringen.
   */
  const beatBudget = knobRadius * 1.5;
  const beatDotSize = Math.max(
    3,
    Math.min(8, beatBudget / (1.75 * beatDots.length - 0.75)),
  );
  const beatGap = Math.max(2, Math.min(6, beatDotSize * 0.75));

  /** Aldrig större än de mått texten är satt i — bara mindre. */
  const textskala = Math.min(1, size / FULL_STORLEK);

  return (
    <View
      ref={wheelRef}
      onLayout={measure}
      // Vridgesten finns inte för en skärmläsare. Justerbar-rollen ger
      // svep-upp/ner i stället: ett slag i minuten per svep, med värdet
      // uppläst efter varje ändring.
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={T.uppläst.tempohjul}
      accessibilityHint={T.uppläst.justerbarLedtråd}
      accessibilityValue={{ min: MIN_BPM, max: MAX_BPM, now: bpm, text: T.uppläst.slagPerMinutVärde(bpm) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === 'increment' ? 1 : -1;
        onChange(clampBpm(bpm + delta));
      }}
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
          const outer = polar(cx, cy, tickOuter, angle);
          const inner = polar(cx, cy, major ? tickInnerMajor : tickInnerMinor, angle);
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
            const grip = polar(cx, cy, gripRadius, needleAngle);
            return <Circle cx={grip.x} cy={grip.y} r={7} fill={t.accent} />;
          })()}
        </G>
      </Svg>

      <View style={styles.readout}>
        <Text
          style={[
            styles.bpm,
            { fontSize: BPM_TEXT * textskala, lineHeight: BPM_RADHÖJD * textskala },
          ]}
        >
          {bpm}
        </Text>
        <Text style={[styles.unit, { fontSize: ENHET_TEXT * textskala }]}>
          {T.lista.slagPerMinut}
        </Text>
        <View
          style={[
            styles.beats,
            { gap: beatGap, marginTop: TAKTPRICKAR_AVSTÅND * textskala },
          ]}
        >
          {beatDots.map((index) => (
            <View
              key={index}
              style={[
                styles.beatDot,
                { width: beatDotSize, height: beatDotSize, borderRadius: radius.pill },
                index === 0 && styles.beatDotFirst,
                aktivTaktdel === index && styles.beatDotActive,
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
    // Siffrorna ligger över hjulet men får inte ta emot greppet — det hör
    // till hjulet under, som ska kunna vridas var man än sätter fingret.
    pointerEvents: 'none',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Storleken sätts vid ritningen, se textskala: den följer hjulets storlek.
  bpm: {
    color: t.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: t.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  beats: {
    flexDirection: 'row',
    gap: 6,
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
