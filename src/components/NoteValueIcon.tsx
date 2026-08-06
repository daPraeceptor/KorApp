/**
 * Notvärden ritade som riktig notbild.
 *
 * Unicode har bara glyfer för en och två sammanbalkade noter, så trioler och
 * sextondelar går inte att skriva ut som text. De ritas därför här: rätt antal
 * noter, rätt antal balkar, och en trea över triolen.
 */
import React from 'react';

import { SubdivisionId } from '../audio/subdivisions';
import Svg, { Circle, Ellipse, Line, Rect, Text as SvgText } from 'react-native-svg';

const WIDTH = 48;
const HEIGHT = 34;

const HEAD_RX = 3.6;
const HEAD_RY = 2.7;
const HEAD_Y = 26;
const SPACING = 9;

/** Balkarnas höjd. Stjälkarna går upp hit från notheadet. */
const BEAM_Y = 10.3;
const BEAM_THICKNESS = 3;
const BEAM_GAP = 5;

export type NoteValue = SubdivisionId;

interface Shape {
  /** Antal noter. */
  count: number;
  /** Antal balkar över gruppen. */
  beams: number;
  /**
   * Siffror över balken. Varje siffra centreras över sin egen grupp av noter,
   * så att sextondelsswingen får en trea över vardera gungande paret i stället
   * för en enda över alltihop.
   */
  numerals?: Array<{ text: string; notes: number[] }>;
  /**
   * Noternas ritlägen som andelar av gruppens bredd. Utan värde fördelas de
   * jämnt. Ojämna lägen är hela poängen med swing och punkterat — bilden ska
   * visa att andra noten kommer sent.
   *
   * Lägena speglar rytmen men är inte strikt proportionella mot den. En
   * notbild är en symbol, och helt proportionell placering får noterna att
   * krocka där två klick ligger tätt.
   */
  positions?: number[];
  /**
   * Gruppens bredd i notavstånd. Utan värde blir den antalet noter minus ett,
   * vilket är rätt för jämna figurer. Ojämna behöver mer: swingens andra not
   * sitter på två tredjedelar, och med bara ett notavstånd att fördela över
   * hamnar den närmare grundtonen än en vanlig åttondel gör.
   */
  spanUnits?: number;
  /** Deltoner som får en extra balk, för punkterade figurer. */
  extraBeamOn?: number[];
  /** Punkt efter noten, som i punkterad åttondel. */
  dotOn?: number[];
}

const SHAPES: Record<NoteValue, Shape> = {
  quarter: { count: 1, beams: 0 },
  eighth: { count: 2, beams: 1 },
  triplet: { count: 3, beams: 1, numerals: [{ text: '3', notes: [0, 1, 2] }] },
  sixteenth: { count: 4, beams: 2 },

  // Swing ritas som två åttondelar där den andra sitter där triolens tredje
  // del ligger — samma lägen som klicken faktiskt hörs på.
  swing8: {
    count: 2,
    beams: 1,
    numerals: [{ text: '3', notes: [0, 1] }],
    positions: [0, 2 / 3],
    spanUnits: 2.4,
  },
  // Punkterad åttondel plus sextondel: punkt efter första, extra balk på andra.
  dotted8: {
    count: 2,
    beams: 1,
    positions: [0, 3 / 4],
    spanUnits: 2.8,
    extraBeamOn: [1],
    dotOn: [0],
  },
  /**
   * Varje åttondelspar gungar för sig, så varje par får sin egen trea.
   *
   * Bara en genomgående balk: i ett gungande par varar första noten dubbelt så
   * länge som den andra, alltså en åttondel mot en sextondel. Den undre balken
   * ritas därför som stumpar på enbart de korta noterna, och är bruten vid de
   * långa — precis som figuren skrivs i noter.
   */
  swing16: {
    count: 4,
    beams: 1,
    numerals: [
      { text: '3', notes: [0, 1] },
      { text: '3', notes: [2, 3] },
    ],
    // Klicken ligger på 0, 1/3, 1/2 och 5/6. Ritas de så krockar andra och
    // tredje noten — mellan dem går bara en sjättedel av slaget mot en
    // tredjedel mellan de övriga. Mellanrummet är därför något utjämnat.
    positions: [0, 0.3, 0.52, 0.82],
    spanUnits: 4.2,
    extraBeamOn: [1, 3],
  },
  // Fem noter med fullt notavstånd skulle sticka ut över rutans högerkant.
  quintuplet: {
    count: 5,
    beams: 2,
    numerals: [{ text: '5', notes: [0, 1, 2, 3, 4] }],
    spanUnits: 3.6,
  },
};

export function NoteValueIcon({
  value,
  color,
}: {
  value: NoteValue;
  color: string;
}) {
  const { count, beams, numerals, positions, spanUnits, extraBeamOn, dotOn } =
    SHAPES[value];

  // Jämna figurer fördelas jämnt över gruppen, ojämna följer sina egna lägen
  // så att bilden speglar när klicken faktiskt hörs.
  const span = (spanUnits ?? count - 1) * SPACING;
  const startCx = (WIDTH - span - HEAD_RX * 2) / 2 + HEAD_RX;
  const andelar =
    positions ?? Array.from({ length: count }, (_, i) => (count > 1 ? i / (count - 1) : 0));
  const heads = andelar.map((andel) => startCx + andel * span);

  // Stjälken sitter i notheadets högra kant när den pekar uppåt.
  const stemX = (cx: number) => cx + HEAD_RX - 0.4;
  const vänster = stemX(heads[0]) - 0.7;
  const höger = stemX(heads[heads.length - 1]) + 0.7;

  // Siffrorna centreras över sina egna stjälkar, inte över ikonen. Två siffror
  // ritas mindre så att de får plats var för sig.
  const numeralSize = (numerals?.length ?? 0) > 1 ? 8 : 9;

  return (
    <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      {numerals?.map((n, i) => {
        const stjälkar = n.notes.map((index) => stemX(heads[index]));
        const mitt = (Math.min(...stjälkar) + Math.max(...stjälkar)) / 2;
        return (
          <SvgText
            key={i}
            x={mitt}
            y={BEAM_Y - 2.8}
            fontSize={numeralSize}
            fontWeight="700"
            fill={color}
            textAnchor="middle"
          >
            {n.text}
          </SvgText>
        );
      })}

      {heads.map((cx, i) => (
        <React.Fragment key={i}>
          <Ellipse cx={cx} cy={HEAD_Y} rx={HEAD_RX} ry={HEAD_RY} fill={color} />
          {dotOn?.includes(i) ? (
            <Circle cx={cx + HEAD_RX + 3} cy={HEAD_Y} r={1.6} fill={color} />
          ) : null}
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
          x={vänster}
          y={BEAM_Y + i * BEAM_GAP}
          width={höger - vänster}
          height={BEAM_THICKNESS}
          fill={color}
        />
      ))}

      {/* Kort extra balk på enstaka noter, som sextondelen i en punkterad figur. */}
      {extraBeamOn?.map((i) => (
        <Rect
          key={`extra-${i}`}
          x={stemX(heads[i]) - 4.5}
          y={BEAM_Y + beams * BEAM_GAP}
          width={5.2}
          height={BEAM_THICKNESS}
          fill={color}
        />
      ))}
    </Svg>
  );
}
