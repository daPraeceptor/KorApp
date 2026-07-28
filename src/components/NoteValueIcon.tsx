/**
 * Notvärden ritade som riktig notbild.
 *
 * Unicode har bara glyfer för en och två sammanbalkade noter, så trioler och
 * sextondelar går inte att skriva ut som text. De ritas därför här: rätt antal
 * noter, rätt antal balkar, och en trea över triolen.
 */
import React from 'react';
import Svg, { Ellipse, Line, Rect, Text as SvgText } from 'react-native-svg';

const WIDTH = 48;
const HEIGHT = 34;

const HEAD_RX = 3.6;
const HEAD_RY = 2.7;
const HEAD_Y = 26;
const SPACING = 9;

/** Balkarnas höjd. Stjälkarna går upp hit från notheadet. */
const BEAM_Y = 12;
const BEAM_THICKNESS = 3;
const BEAM_GAP = 5;

export type NoteValue = 'quarter' | 'eighths' | 'triplet' | 'sixteenths';

const SHAPES: Record<NoteValue, { count: number; beams: number; triplet: boolean }> = {
  quarter: { count: 1, beams: 0, triplet: false },
  eighths: { count: 2, beams: 1, triplet: false },
  triplet: { count: 3, beams: 1, triplet: true },
  sixteenths: { count: 4, beams: 2, triplet: false },
};

export function NoteValueIcon({
  value,
  color,
}: {
  value: NoteValue;
  color: string;
}) {
  const { count, beams, triplet } = SHAPES[value];

  const span = (count - 1) * SPACING + HEAD_RX * 2;
  const startCx = (WIDTH - span) / 2 + HEAD_RX;
  const heads = Array.from({ length: count }, (_, i) => startCx + i * SPACING);
  // Stjälken sitter i notheadets högra kant när den pekar uppåt.
  const stemX = (cx: number) => cx + HEAD_RX - 0.4;

  // Trean centreras över balken, inte över ikonen. Eftersom stjälkarna sitter
  // till höger om notheaden ligger balkens mitt en bit åt höger — och för tre
  // noter är det precis den mittersta stjälken.
  const beamCenterX = (stemX(heads[0]) + stemX(heads[heads.length - 1])) / 2;

  return (
    <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      {triplet ? (
        <SvgText
          x={beamCenterX}
          y={9}
          fontSize={10}
          fontWeight="700"
          fill={color}
          textAnchor="middle"
        >
          3
        </SvgText>
      ) : null}

      {heads.map((cx) => (
        <React.Fragment key={cx}>
          <Ellipse cx={cx} cy={HEAD_Y} rx={HEAD_RX} ry={HEAD_RY} fill={color} />
          <Line
            x1={stemX(cx)}
            y1={HEAD_Y}
            x2={stemX(cx)}
            y2={BEAM_Y}
            stroke={color}
            strokeWidth={1.4}
          />
        </React.Fragment>
      ))}

      {Array.from({ length: beams }, (_, i) => (
        <Rect
          key={i}
          x={stemX(heads[0]) - 0.7}
          y={BEAM_Y + i * BEAM_GAP}
          width={stemX(heads[heads.length - 1]) - stemX(heads[0]) + 1.4}
          height={BEAM_THICKNESS}
          fill={color}
        />
      ))}
    </Svg>
  );
}
