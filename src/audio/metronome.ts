/**
 * Metronom med look-ahead-schemaläggning.
 *
 * En timer som direkt spelar varje klick driver hörbart iväg, eftersom
 * JavaScript-timers inte är exakta. I stället tittar en gles timer en bit
 * framåt i tiden och bokar in alla klick som infaller inom fönstret på
 * ljudkortets klocka, som är exakt.
 */
import { AudioEngine, ClickVariant, audioEngine } from './engine';
import { clampBpm } from './tempo';

export { MAX_BPM, MIN_BPM, clampBpm, tempoFromTaps } from './tempo';

/** Hur ofta schemaläggaren vaknar och tittar framåt. */
const TIMER_INTERVAL_MS = 25;

/** Hur långt fram klick bokas in. Måste vara längre än timerns intervall. */
const SCHEDULE_AHEAD = 0.12;

export interface MetronomeState {
  bpm: number;
  beatsPerBar: number;
  /** 1 = fjärdedelar, 2 = åttondelar, 3 = triolet, 4 = sextondelar. */
  subdivision: number;
  accentFirstBeat: boolean;
}

export const DEFAULT_METRONOME: MetronomeState = {
  bpm: 90,
  beatsPerBar: 4,
  subdivision: 1,
  accentFirstBeat: true,
};

export class Metronome {
  private engine: AudioEngine;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTickTime = 0;
  private tick = 0;
  private state: MetronomeState = { ...DEFAULT_METRONOME };

  /** Anropas när en taktdel hörs, med taktdelens nummer från noll. */
  onBeat: ((beat: number) => void) | null = null;

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
    next.subdivision = Math.max(1, Math.round(next.subdivision));

    const restartCounting =
      next.beatsPerBar !== this.state.beatsPerBar ||
      next.subdivision !== this.state.subdivision;

    this.state = next;

    if (restartCounting && this.isRunning) {
      // Taktarten bytte — börja om på en etta så att accenten hamnar rätt.
      this.tick = 0;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    const ctx = await this.engine.ensure();

    this.tick = 0;
    // Liten marginal så att det första klicket hinner bokas in innan det ska låta.
    this.nextTickTime = ctx.currentTime + 0.06;

    this.timer = setInterval(() => this.scheduleWindow(), TIMER_INTERVAL_MS);
    this.scheduleWindow();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.tick = 0;
  }

  async toggle(): Promise<boolean> {
    if (this.isRunning) {
      this.stop();
      return false;
    }
    await this.start();
    return true;
  }

  private secondsPerTick(): number {
    return 60 / this.state.bpm / this.state.subdivision;
  }

  private scheduleWindow(): void {
    const now = this.engine.currentTime;

    while (this.nextTickTime < now + SCHEDULE_AHEAD) {
      const ticksPerBar = this.state.beatsPerBar * this.state.subdivision;
      const positionInBar = this.tick % ticksPerBar;
      const isSubdivision = positionInBar % this.state.subdivision !== 0;
      const isFirstBeat = positionInBar === 0;

      let variant: ClickVariant;
      if (isSubdivision) {
        variant = 'subdivision';
      } else if (isFirstBeat && this.state.accentFirstBeat) {
        variant = 'accent';
      } else {
        variant = 'beat';
      }

      this.engine.scheduleClick(this.nextTickTime, variant);

      if (!isSubdivision && this.onBeat) {
        const beat = positionInBar / this.state.subdivision;
        const delayMs = Math.max((this.nextTickTime - now) * 1000, 0);
        // Blinket får ligga någon millisekund fel; det är bara en visuell markering.
        setTimeout(() => this.onBeat?.(beat), delayMs);
      }

      this.nextTickTime += this.secondsPerTick();
      this.tick += 1;
    }
  }
}

export const metronome = new Metronome();
