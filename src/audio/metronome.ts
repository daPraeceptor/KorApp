/**
 * Metronom med look-ahead-schemaläggning.
 *
 * En timer som direkt spelar varje klick driver hörbart iväg, eftersom
 * JavaScript-timers inte är exakta. I stället tittar en gles timer en bit
 * framåt i tiden och bokar in alla klick som infaller inom fönstret på
 * ljudkortets klocka, som är exakt.
 */
import { type ClickVariant, AudioEngine, audioEngine } from './engine.ts';
import {
  DEFAULT_SUBDIVISION,
  type SubdivisionId,
  subdivisionOr,
  toSubdivisionId,
} from './subdivisions.ts';
import { DEFAULT_BPM, clampBeatsPerBar, clampBpm } from './tempo.ts';

export { MAX_BPM, MIN_BPM, clampBpm, tempoFromTaps } from './tempo.ts';

/** Hur ofta schemaläggaren vaknar och tittar framåt. */
const TIMER_INTERVAL_MS = 25;

/** Hur långt fram klick bokas in. Måste vara längre än timerns intervall. */
const SCHEDULE_AHEAD = 0.12;

export interface MetronomeState {
  bpm: number;
  beatsPerBar: number;
  subdivision: SubdivisionId;
  accentFirstBeat: boolean;
}

export const DEFAULT_METRONOME: MetronomeState = {
  bpm: DEFAULT_BPM,
  beatsPerBar: 4,
  subdivision: DEFAULT_SUBDIVISION,
  accentFirstBeat: true,
};

/**
 * Första taktgränsen räknat från `start` som ligger vid eller efter `tidigast`.
 * Räknas i ett steg i stället för i en slinga, så att den håller även när
 * hoppet är stort.
 */
function nextBoundary(start: number, beatSeconds: number, tidigast: number): number {
  if (start >= tidigast) {
    return start;
  }
  return start + Math.ceil((tidigast - start) / beatSeconds) * beatSeconds;
}

export class Metronome {
  private engine: AudioEngine;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Ljudkortstiden när det pågående taktslaget började. */
  private beatStart = 0;
  /** Vilket läge inom taktslaget som står näst på tur. */
  private offsetIndex = 0;
  /** Löpande taktslag sedan starten, för att veta var i takten vi är. */
  private beatIndex = 0;
  private state: MetronomeState = { ...DEFAULT_METRONOME };

  /** Anropas när en taktdel hörs, med taktdelens nummer från noll. */
  onBeat: ((beat: number) => void) | null = null;

  /**
   * Anropas för varje hörbart klick, underdelningarna inräknade. Automat-
   * stoppet räknar de här: sexton slag är sexton ljud, oavsett vad de är
   * för slags delar av takten.
   */
  onClick: (() => void) | null = null;

  constructor(engine: AudioEngine = audioEngine) {
    this.engine = engine;
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  getState(): MetronomeState {
    return { ...this.state };
  }

  /** Ändringar slår igenom direkt, även mitt under pågående gång. */
  update(patch: Partial<MetronomeState>): void {
    const next = { ...this.state, ...patch };
    next.bpm = clampBpm(next.bpm);
    next.beatsPerBar = clampBeatsPerBar(next.beatsPerBar);
    next.subdivision = toSubdivisionId(next.subdivision);

    const restartCounting =
      next.beatsPerBar !== this.state.beatsPerBar ||
      next.subdivision !== this.state.subdivision;

    this.state = next;

    if (restartCounting && this.isRunning) {
      // Taktarten bytte — börja om på en etta så att accenten hamnar rätt.
      // Lägesräknaren måste nollas också: den nya underdelningen kan ha färre
      // lägen än den gamla, och skulle annars peka utanför sin egen lista.
      this.beatIndex = 0;
      this.offsetIndex = 0;
      // Taktslaget vi står i är till hälften spelat, och en bit av det som
      // kommer ligger redan inbokad hos ljudkortet. Börjar den nya räkningen
      // där slaget började skulle dess etta hamna före ljud som redan är på
      // väg ut — man hör ett snubblande dubbelslag. Den nya takten tar därför
      // vid vid nästa taktgräns bortom det som hunnit bokas.
      this.beatStart = nextBoundary(
        this.beatStart,
        60 / next.bpm,
        this.engine.currentTime + SCHEDULE_AHEAD,
      );
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    const ctx = await this.engine.ensure();

    this.beatIndex = 0;
    this.offsetIndex = 0;
    // Liten marginal så att det första klicket hinner bokas in innan det ska låta.
    this.beatStart = ctx.currentTime + 0.06;

    this.timer = setInterval(() => this.scheduleWindow(), TIMER_INTERVAL_MS);
    this.scheduleWindow();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.beatIndex = 0;
    this.offsetIndex = 0;
  }

  async toggle(): Promise<boolean> {
    if (this.isRunning) {
      this.stop();
      return false;
    }
    await this.start();
    return true;
  }

  /**
   * Bokar in alla klick som infaller inom fönstret.
   *
   * Tiderna räknas ut från taktslagets början plus underdelningens lägen, i
   * stället för att stega vidare med ett fast avstånd. Det är vad som gör
   * ojämna figurer som swing och punkterat möjliga.
   */
  private scheduleWindow(): void {
    const now = this.engine.currentTime;
    const beatSeconds = 60 / this.state.bpm;

    // Ibland har tiden runnit ifrån schemaläggaren: telefonen låg släckt, en
    // tung omritning höll huvudtråden, eller webbläsaren strypte timern i en
    // dold flik. Ljudkortets klocka gick vidare hela tiden.
    //
    // Det som skulle hörts då hörs inte bättre nu. Bokades de missade slagen
    // ändå skulle var och ett klämmas fram till nuet och allihop låta på
    // samma millisekund — ett knäpp i stället för en puls. Räkningen hoppar
    // därför fram i hela taktslag, så att pulsen ligger kvar i sitt rutnät.
    if (now - this.beatStart > beatSeconds) {
      const missade = Math.floor((now - this.beatStart) / beatSeconds);
      this.beatStart += missade * beatSeconds;
      this.beatIndex += missade;
      this.offsetIndex = 0;
    }

    for (;;) {
      const spec = subdivisionOr(this.state.subdivision);
      // Underdelningen kan ha bytts mitt i ett taktslag till en med färre lägen.
      if (this.offsetIndex >= spec.offsets.length) {
        this.offsetIndex = 0;
        this.beatStart += beatSeconds;
        this.beatIndex += 1;
        continue;
      }

      const tickTime = this.beatStart + spec.offsets[this.offsetIndex] * beatSeconds;
      if (tickTime >= now + SCHEDULE_AHEAD) {
        return;
      }

      const isSubdivision = this.offsetIndex !== 0;
      const positionInBar = this.beatIndex % this.state.beatsPerBar;

      // Underdelningar inom det taktslag vi hoppade in i kan ligga bakom oss,
      // liksom allt som hann passera under en kort hackning. De räknas förbi
      // utan att bokas — ett klick vars stund är över ska förbli tyst.
      if (tickTime >= now) {
        let variant: ClickVariant;
        if (isSubdivision) {
          variant = 'subdivision';
        } else if (positionInBar === 0 && this.state.accentFirstBeat) {
          variant = 'accent';
        } else {
          variant = 'beat';
        }

        this.engine.scheduleClick(tickTime, variant);

        const delayMs = Math.max((tickTime - now) * 1000, 0);
        if (!isSubdivision && this.onBeat) {
          // Blinket får ligga någon millisekund fel; det är bara en visuell markering.
          setTimeout(() => this.onBeat?.(positionInBar), delayMs);
        }

        if (this.onClick) {
          setTimeout(() => this.onClick?.(), delayMs);
        }
      }

      this.offsetIndex += 1;
      if (this.offsetIndex >= spec.offsets.length) {
        this.offsetIndex = 0;
        this.beatStart += beatSeconds;
        this.beatIndex += 1;
      }
    }
  }
}

export const metronome = new Metronome();
