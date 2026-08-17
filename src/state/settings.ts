/**
 * Inställningarnas modell, och inläsningen av dem från lagringen.
 *
 * Låtarna har alltid lästs in med kontroll av varje fält. Inställningarna
 * gjorde det inte: de lades rakt ovanpå standardvärdena, och ett enda tokigt
 * värde kunde därför följa med ända in i ljudmotorn — en kammarton på noll
 * ger toner utan frekvens, och en sådan går inte att spela.
 *
 * Ligger skild från AppState för att kunna provas utan React.
 */
import { TIMBRES, type TimbreId } from '../audio/timbres.ts';
import { THEME_META, type ThemeId } from '../theme.ts';
import {
  MAX_TONE_GAP_BPM,
  MIN_TONE_GAP_BPM,
} from '../store/songs.ts';
import type {
  LabelReference,
  LabelSystem,
  NoteNaming,
} from '../theory/tuning.ts';

export type StartTab = 'auto' | 'play' | 'songs';

/** Klassisk pendel, streck fram och tillbaka, studsande boll, eller ingen alls. */
export type MetronomeVisualStyle = 'pendulum' | 'bar' | 'ball' | 'none';

export const MIN_AUTO_STOP_BEATS = 2;
export const MAX_AUTO_STOP_BEATS = 64;

/** Kammartonens gränser: barockens 415 Hz i botten, 466 Hz i toppen. */
export const MIN_A4 = 415;
export const MAX_A4 = 466;

/** Under en tiondel hörs metronomen inte i en sal. */
export const MIN_VOLUME = 0.1;

/**
 * Hur många engångsändringar som körts på de sparade inställningarna.
 *
 * En sparad inställning väger tyngre än ett förval — den är ett val någon
 * gjort. Men ibland behöver ett gammalt val ändå skrivas om en gång, och då
 * räknas det här talet upp. Lagringen bär sitt eget tal, och skiljer det sig
 * från det senaste körs mellanskillnaden och talet skrivs om.
 *
 * 1: klangfärgen ställs om till plattformens förval, så att telefoner som
 *    valt sin klang före den inspelade flygeln också får höra den.
 */
export const SENASTE_MIGRATION = 1;

export interface Settings {
  /** Kammartonens frekvens. Många orglar och blåsorkestrar ligger på 442. */
  a4: number;
  naming: NoteNaming;
  volume: number;
  /**
   * Standardhastighet för tongivningen. Varje låt bär sitt eget värde; det här
   * är vad en ny låt börjar med.
   */
  defaultToneGapBpm: number;
  /** Om tonnamn skrivs ut på klaviaturens tangenter. */
  showNoteNames: boolean;
  /** Bokstäver, solmisation eller romerska tonplatssiffror. */
  labelSystem: LabelSystem;
  /** Om solmisation och tonplatser räknas från C eller från grundtonen. */
  labelReference: LabelReference;
  /**
   * Om grundtonstangenten märks ut även i tempererad stämning. I ren stämning
   * märks den alltid ut, eftersom allt annat stäms mot den.
   */
  markTonicInTempered: boolean;
  /** Klangfärg för tongivningen och klaviaturen. */
  toneTimbre: TimbreId;
  /** Appens färgtema. */
  themeId: ThemeId;
  /** Visar swing, punkterat och kvintol bland underdelningarna. */
  showAdvancedSubdivisions: boolean;
  /** Hur takten visas grafiskt i spelvyn. */
  metronomeVisual: MetronomeVisualStyle;
  /**
   * Vilken flik appen öppnar i. "auto" väljer listan när det finns sparade
   * låtar och skapandet annars — utan låtar finns ingen lista att visa.
   */
  startTab: StartTab;
  /**
   * Stoppar metronomen av sig själv efter ett antal slag, men bara när
   * den startats från låtlistan. Där vill man oftast bara känna tempot en
   * stund; i spelvyn ska den gå tills man säger till.
   */
  autoStopFromList: boolean;
  /** Antal hörbara slag — underdelningar inräknade — innan stoppet. */
  autoStopBeats: number;
  /** Ettan klingar ljusare än de andra taktdelarna. */
  accentFirstBeat: boolean;
  /** Telefonen svarar med en liten stöt när något grips eller slår om. */
  haptics: boolean;
  /**
   * Skärmen slocknar inte medan metronomen går. Telefonen ligger framme på
   * notstället under repetitionen och ska inte somna mitt i en sats.
   */
  keepAwake: boolean;
  /**
   * Vilka engångsändringar som körts på just den här lagringen.
   * Se SENASTE_MIGRATION.
   */
  migrationer: number;
  /**
   * Vad redigeringsvyn börjar med. Falskt ger metronomen först, sant lägger
   * tongivningen och klaviaturen överst — för den som mest använder appen
   * till att ge kören tonen.
   */
  tonesFirst: boolean;
}

/** Värdet om det är ett av de tillåtna, annars det man hade. */
function ettAv<T extends string>(
  värde: unknown,
  tillåtna: readonly T[],
  förval: T,
): T {
  return typeof värde === 'string' && (tillåtna as readonly string[]).includes(värde)
    ? (värde as T)
    : förval;
}

function flagga(värde: unknown, förval: boolean): boolean {
  return typeof värde === 'boolean' ? värde : förval;
}

/** En mängd som hör hemma inom ett spann. Utanför spannet dras den in i det. */
function tal(värde: unknown, min: number, max: number, förval: number): number {
  if (typeof värde !== 'number' || !Number.isFinite(värde)) {
    return förval;
  }
  return Math.min(max, Math.max(min, värde));
}

/**
 * Ett värde som antingen är rimligt eller inte alls.
 *
 * Kammartonen dras inte in i sitt spann som en mängd gör. Ett lagrat nollvärde
 * är inte "så lågt som möjligt" utan trasigt, och att tysta läsa det som 415
 * skulle ge kören en helt annan tonhöjd än den bad om. Då är det ärligare att
 * falla tillbaka på 440.
 */
function talIOmråde(värde: unknown, min: number, max: number, förval: number): number {
  if (typeof värde !== 'number' || !Number.isFinite(värde) || värde < min || värde > max) {
    return förval;
  }
  return värde;
}

/**
 * Läser in inställningar ur lagringen. Allt som inte går att känna igen faller
 * tillbaka på det man redan hade, fält för fält — en trasig rad ska kosta just
 * den inställningen, inte alla de andra.
 */
export function normalizeSettings(raw: unknown, fallback: Settings): Settings {
  if (typeof raw !== 'object' || raw === null) {
    return fallback;
  }
  const v = raw as Record<string, unknown>;

  // Engångsändringar. En lagring utan tal är äldre än den första av dem.
  const körda = Math.max(0, Math.round(tal(v.migrationer, 0, SENASTE_MIGRATION, 0)));

  return {
    a4: Math.round(talIOmråde(v.a4, MIN_A4, MAX_A4, fallback.a4)),
    naming: ettAv<NoteNaming>(v.naming, ['swedish', 'international'], fallback.naming),
    volume: tal(v.volume, MIN_VOLUME, 1, fallback.volume),
    defaultToneGapBpm: Math.round(
      tal(v.defaultToneGapBpm, MIN_TONE_GAP_BPM, MAX_TONE_GAP_BPM, fallback.defaultToneGapBpm),
    ),
    showNoteNames: flagga(v.showNoteNames, fallback.showNoteNames),
    labelSystem: ettAv<LabelSystem>(
      v.labelSystem,
      ['letters', 'solfege', 'degrees'],
      fallback.labelSystem,
    ),
    labelReference: ettAv<LabelReference>(v.labelReference, ['c', 'tonic'], fallback.labelReference),
    markTonicInTempered: flagga(v.markTonicInTempered, fallback.markTonicInTempered),
    // Migrering 1 ställer om klangen till plattformens förval en enda gång:
    // telefoner som valde sin klang innan den inspelade flygeln fanns ska få
    // höra den utan att leta i inställningarna.
    toneTimbre:
      körda < 1
        ? fallback.toneTimbre
        : ettAv<TimbreId>(
            v.toneTimbre,
            Object.keys(TIMBRES) as TimbreId[],
            fallback.toneTimbre,
          ),
    migrationer: SENASTE_MIGRATION,
    themeId: ettAv<ThemeId>(v.themeId, Object.keys(THEME_META) as ThemeId[], fallback.themeId),
    showAdvancedSubdivisions: flagga(
      v.showAdvancedSubdivisions,
      fallback.showAdvancedSubdivisions,
    ),
    metronomeVisual: ettAv<MetronomeVisualStyle>(
      v.metronomeVisual,
      ['pendulum', 'bar', 'ball', 'none'],
      fallback.metronomeVisual,
    ),
    startTab: ettAv<StartTab>(v.startTab, ['auto', 'play', 'songs'], fallback.startTab),
    autoStopFromList: flagga(v.autoStopFromList, fallback.autoStopFromList),
    autoStopBeats: Math.round(
      tal(v.autoStopBeats, MIN_AUTO_STOP_BEATS, MAX_AUTO_STOP_BEATS, fallback.autoStopBeats),
    ),
    accentFirstBeat: flagga(v.accentFirstBeat, fallback.accentFirstBeat),
    haptics: flagga(v.haptics, fallback.haptics),
    keepAwake: flagga(v.keepAwake, fallback.keepAwake),
    tonesFirst: flagga(v.tonesFirst, fallback.tonesFirst),
  };
}

/** Läser inställningarna ur lagringens sträng. Trasig JSON ger det man hade. */
export function parseSettings(json: string | null, fallback: Settings): Settings {
  if (!json) {
    return fallback;
  }
  try {
    return normalizeSettings(JSON.parse(json), fallback);
  } catch {
    return fallback;
  }
}
