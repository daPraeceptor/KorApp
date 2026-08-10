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
import { clampBpm } from './tempo.ts';

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
  bpm: 90,
  beatsPerBar: 4,
  subdivision: DEFAULT_SUBDIVISION,
  accentFirstBeat: true,
};

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
    next.beatsPerBar = Math.max(1, Math.round(next.beatsPerBar));
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

      let variant: ClickVariant;
      if (isSubdivision) {
        variant = 'subdivision';
      } else if (positionInBar === 0 && this.state.accentFirstBeat) {
        variant = 'accent';
      } else {
        variant = 'beat';
      }

      this.engine.scheduleClick(tickTime, variant);

      if (!isSubdivision && this.onBeat) {
        const delayMs = Math.max((tickTime - now) * 1000, 0);
        // Blinket får ligga någon millisekund fel; det är bara en visuell markering.
        setTimeout(() => this.onBeat?.(positionInBar), delayMs);
      }

      if (this.onClick) {
        const delayMs = Math.max((tickTime - now) * 1000, 0);
        setTimeout(() => this.onClick?.(), delayMs);
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
