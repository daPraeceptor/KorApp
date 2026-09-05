/**
 * Notvärden ritade som riktig notbild.
 *
 * Unicode har bara glyfer för en och två sammanbalkade noter, så trioler och
 * sextondelar går inte att skriva ut som text. De ritas därför här: rätt antal
 * noter, rätt antal balkar, och en trea över triolen.
 */
import React from 'react';

import { SubdivisionId } from '../audio/subdivisions';
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

const WIDTH = 48;
const HEIGHT = 34;

const HEAD_RX = 3.8;
const HEAD_RY = 2.6;
const HEAD_Y = 26;
const SPACING = 9;

/**
 * Notheadets lutning i grader. Ett graverat nothuvud står inte rakt utan
 * lutar uppåt höger — vänstra sidan av ellipsen ner, högra upp. Negativ
 * vinkel vrider moturs i SVG, eftersom y-axeln pekar nedåt.
 */
const HEAD_TILT = -20;

const TILT_RAD = (HEAD_TILT * Math.PI) / 180;

/**
 * Hur långt ut åt höger det lutande huvudet når. Ett vridet nothuvud är
 * bredare än sin egen rx, och skaftet ska sitta i ytterkanten. Räknas fram
 * här så att en ändrad lutning eller storlek flyttar skaftet med sig.
 */
const HEAD_REACH = Math.hypot(
  HEAD_RX * Math.cos(TILT_RAD),
  HEAD_RY * Math.sin(TILT_RAD),
);

/** Långaxelns ändpunkt räknat från huvudets mitt, efter lutningen. */
const HEAD_DX = HEAD_RX * Math.cos(TILT_RAD);
const HEAD_DY = HEAD_RX * Math.sin(TILT_RAD);

/**
 * Det lutande nothuvudet som två halva bågar mellan långaxelns ändpunkter.
 *
 * Ritas som båge i stället för vriden ellips därför att bågkommandot bär
 * lutningen själv, medan `rotation`-propet är utfasat och den vridning man
 * skriver in i `transform`-strängen tappar sitt vridningscentrum på vägen.
 */
const headPath = (cx: number, cy: number) => {
  const x1 = cx - HEAD_DX;
  const y1 = cy - HEAD_DY;
  const x2 = cx + HEAD_DX;
  const y2 = cy + HEAD_DY;
  return (
    `M ${x1} ${y1}` +
    ` A ${HEAD_RX} ${HEAD_RY} ${HEAD_TILT} 0 1 ${x2} ${y2}` +
    ` A ${HEAD_RX} ${HEAD_RY} ${HEAD_TILT} 0 1 ${x1} ${y1} Z`
  );
};

/** Balkarnas höjd. Stjälkarna går upp hit från notheadet. */
const BEAM_Y = 10.3;
const BEAM_THICKNESS = 3;
const BEAM_GAP = 5;

/** Fanans bredd åt höger. Behövs för att kunna centrera bilden. */
const FLAG_WIDTH = 6;

/**
 * Kortare skaft för sextondelen och kvintolen. Den dubbla balken gör annars
 * de två figurerna märkbart högre än resten av raden. Balken hamnar här på
 * exakt samma höjd som encelliga figurers enda balk (BEAM_Y) — en åtta
 * procents förkortning räckte inte för kvintolen, vars femma annars fortsatt
 * trängdes mot bildens överkant; med balken indragen till samma höjd som hos
 * till exempel triolen får siffran samma luft som där.
 */
const SHORT_STEM_Y = BEAM_Y + BEAM_GAP;

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
  /**
   * Deltoner som får en fana i stället för balk. En ensam åttondel kan inte
   * balkas ihop med en fjärdedel — den bär sin fana själv.
   */
  flagOn?: number[];
  /** Punkt efter noten, som i punkterad åttondel. */
  dotOn?: number[];
  /**
   * Ersätter BEAM_Y som skaftets och balkens ankarhöjd för den här figuren.
   * Används för att göra enstaka figurer kortskaftade utan att rubba resten.
   */
  stemBaseY?: number;
}

const SHAPES: Record<NoteValue, Shape> = {
  quarter: { count: 1, beams: 0 },
  eighth: { count: 2, beams: 1 },
  triplet: { count: 3, beams: 1, numerals: [{ text: '3', notes: [0, 1, 2] }] },
  sixteenth: { count: 4, beams: 2, stemBaseY: SHORT_STEM_Y },

  /**
   * Fjärdedel plus åttondel under en trea — så skrivs gungande åttondelar.
   *
   * Första noten varar två tredjedelar av slaget och andra en tredjedel, precis
   * vad triolfjärdedelen och trioláttondelen betyder. Två balkade åttondelar
   * hade sagt att slaget delas jämnt, alltså motsatsen till swing.
   *
   * Utan balk mellan noterna bär åttondelen sin egen fana.
   */
  swing8: {
    count: 2,
    beams: 0,
    numerals: [{ text: '3', notes: [0, 1] }],
    positions: [0, 2 / 3],
    spanUnits: 2.4,
    flagOn: [1],
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
    stemBaseY: SHORT_STEM_Y,
  },
  /**
   * Kvintolswing: punkterad åttondel plus åttondel i stället för fjärdedel
   * plus åttondel, eftersom 3:2-förhållandet (tredje femtedelen) är för
   * jämnt för att en oflaggad "fjärdedel" ska se ut som den långa noten.
   * Båda noterna bär därför egen fana, med punkten på den första.
   */
  swing5: {
    count: 2,
    beams: 0,
    numerals: [{ text: '5', notes: [0, 1] }],
    positions: [0, 3 / 5],
    spanUnits: 2.6,
    flagOn: [0, 1],
    dotOn: [0],
  },
};

export function NoteValueIcon({
  value,
  color,
}: {
  value: NoteValue;
  color: string;
}) {
  const {
    count,
    beams,
    numerals,
    positions,
    spanUnits,
    extraBeamOn,
    dotOn,
    flagOn,
    stemBaseY,
  } = SHAPES[value];
  const basY = stemBaseY ?? BEAM_Y;

  // Jämna figurer fördelas jämnt över gruppen, ojämna följer sina egna lägen
  // så att bilden speglar när klicken faktiskt hörs.
  const span = (spanUnits ?? count - 1) * SPACING;
  // Fanan sticker ut åt höger och räknas med, annars hamnar figuren för långt
  // åt det hållet i rutan.
  const fanBredd = flagOn?.includes(count - 1) ? FLAG_WIDTH : 0;
  const startCx = (WIDTH - span - HEAD_REACH * 2 - fanBredd) / 2 + HEAD_REACH;
  const andelar =
    positions ?? Array.from({ length: count }, (_, i) => (count > 1 ? i / (count - 1) : 0));
  const heads = andelar.map((andel) => startCx + andel * span);

  // Stjälken sitter i notheadets högra kant när den pekar uppåt — alltså i
  // det lutande huvudets ytterkant, inte i en orörd ellips.
  const stemX = (cx: number) => cx + HEAD_REACH - 0.5;
  const vänster = stemX(heads[0]) - 0.7;
  const höger = stemX(heads[heads.length - 1]) + 0.7;

  /**
   * Balken närmast notheadet ligger på samma höjd för alla figurer med lika
   * många balkar, oavsett hur många balkar figuren har — annars ser
   * sextondelens och kvintolens stjälkar kortare ut än åttondelens, eftersom
   * den andra balken annars kilas in mellan huvudet och den första. I stället
   * växer stjälken uppåt, ett balkmellanrum per extra balk, precis som i
   * handskriven notskrift. `stemBaseY` flyttar den här ankarhöjden för
   * enstaka figurer, som sextondelens och kvintolens kortare skaft.
   */
  const stemTop = beams > 0 ? basY - (beams - 1) * BEAM_GAP : basY;

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
            y={stemTop - 2.8}
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
          <Path d={headPath(cx, HEAD_Y)} fill={color} />
          {dotOn?.includes(i) ? (
            <Circle cx={cx + HEAD_REACH + 3} cy={HEAD_Y} r={1.6} fill={color} />
          ) : null}
          <Line
            x1={stemX(cx)}
            y1={HEAD_Y}
            x2={stemX(cx)}
            y2={stemTop}
            stroke={color}
            strokeWidth={1.4}
          />
          {/* Fanan svänger ut från stjälkens topp och tillbaka in, som på en
              handskriven åttondel. */}
          {flagOn?.includes(i) ? (
            <Path
              d={
                `M ${stemX(cx)} ${basY}` +
                ' c 4.6 1.4, 6 3.6, 4.6 7.4' +
                ' c 0.4 -3.4, -1.6 -4.8, -4.6 -5.6 z'
              }
              fill={color}
            />
          ) : null}
        </React.Fragment>
      ))}

      {Array.from({ length: beams }, (_, i) => (
        <Rect
          key={i}
          x={vänster}
          y={basY - i * BEAM_GAP}
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
          y={basY + beams * BEAM_GAP}
          width={5.2}
          height={BEAM_THICKNESS}
          fill={color}
        />
      ))}
    </Svg>
  );
}
