/**
 * Ljudmotor: metronomklick och tonsyntes för körens starttoner.
 *
 * All schemaläggning sker mot ljudkortets egen klocka (ctx.currentTime) i stället
 * för JavaScript-timers, eftersom timers driver iväg så fort appen får annat att göra.
 */
import {
  AudioContextLike,
  GainNodeLike,
  OscillatorNodeLike,
  createAudioContext,
  unlockAudioContext,
} from './context';

/** Nivå som exponentiella ramper går mot i stället för noll, som de inte klarar. */
const SILENCE = 0.0001;

/**
 * Övertoner för körtonen.
 *
 * Den femte övertonen är inte kosmetisk: svävningen i en stor ters uppstår
 * mellan grundtonens femte överton och tersens fjärde. Utan den finns
 * skillnaden mellan tempererad och ren stämning helt enkelt inte i ljudet,
 * hur rätt frekvenserna än är räknade. Samma sak gäller den sjätte övertonen
 * för sexter och kvinter.
 */
const PARTIALS: ReadonlyArray<{ harmonic: number; gain: number }> = [
  { harmonic: 1, gain: 1 },
  { harmonic: 2, gain: 0.5 },
  { harmonic: 3, gain: 0.35 },
  { harmonic: 4, gain: 0.25 },
  { harmonic: 5, gain: 0.22 },
  { harmonic: 6, gain: 0.15 },
];

const PARTIAL_SUM = PARTIALS.reduce((sum, partial) => sum + partial.gain, 0);

/** Sammanlagd toppnivå för en enskild ton, så att flera toner inte klipper. */
const VOICE_PEAK = 0.5;

const ATTACK = 0.015;
const DECAY = 0.12;
const SUSTAIN = 0.75;
const RELEASE = 0.35;

interface Voice {
  oscillators: OscillatorNodeLike[];
  envelope: GainNodeLike;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

/** Taktens etta, en vanlig taktdel, eller en underdelning mellan taktdelarna. */
export type ClickVariant = 'accent' | 'beat' | 'subdivision';

const CLICK_VARIANTS: Record<ClickVariant, { frequency: number; peak: number }> = {
  accent: { frequency: 1800, peak: 0.9 },
  beat: { frequency: 1200, peak: 0.55 },
  subdivision: { frequency: 900, peak: 0.25 },
};

/** Alla toner på en gång, eller en i taget i den ordning de kommer. */
export type ToneMode = 'together' | 'sequence';

export class AudioEngine {
  private ctx: AudioContextLike | null = null;
  private master: GainNodeLike | null = null;
  private voices = new Map<string, Voice>();
  private volume = 0.8;
  /** Timers och röster som hör till en pågående tongivning, så den kan avbrytas. */
  private toneTimers = new Set<ReturnType<typeof setTimeout>>();
  private toneVoiceIds = new Set<string>();

  /** Skapar och låser upp ljudkontexten. Måste anropas från en användarhandling på webben. */
  async ensure(): Promise<AudioContextLike> {
    if (!this.ctx) {
      this.ctx = createAudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    await unlockAudioContext(this.ctx);
    return this.ctx;
  }

  get isReady(): boolean {
    return this.ctx !== null;
  }

  get currentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) {
      this.master.gain.value = this.volume;
    }
  }

  /**
   * Lägger ett metronomklick på en exakt tidpunkt i framtiden.
   * Ettan är ljusast och starkast, underdelningar dovast och svagast.
   */
  scheduleClick(time: number, variant: ClickVariant): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      return;
    }

    const at = Math.max(time, ctx.currentTime);
    const duration = variant === 'subdivision' ? 0.03 : 0.045;
    const { frequency, peak } = CLICK_VARIANTS[variant];

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, at);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(SILENCE, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(SILENCE, at + duration);

    osc.connect(gain);
    gain.connect(master);

    osc.start(at);
    osc.stop(at + duration + 0.02);

    const cleanupIn = (at - ctx.currentTime + duration + 0.1) * 1000;
    setTimeout(() => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Noderna kan redan vara frikopplade när kontexten stängts.
      }
    }, Math.max(cleanupIn, 0));
  }

  /** Startar en ton som klingar tills stopVoice anropas. Används av klaviaturen. */
  startVoice(id: string, frequency: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      return;
    }

    this.stopVoice(id, true);

    const now = ctx.currentTime;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(SILENCE, now);
    envelope.gain.linearRampToValueAtTime(1, now + ATTACK);
    envelope.gain.linearRampToValueAtTime(SUSTAIN, now + ATTACK + DECAY);
    envelope.connect(master);

    const oscillators: OscillatorNodeLike[] = [];
    for (const { harmonic, gain: level } of PARTIALS) {
      const partialFrequency = frequency * harmonic;
      // Hoppa över övertoner ovanför hörselområdet, de ger bara vikning.
      if (partialFrequency > 18000) {
        continue;
      }
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(partialFrequency, now);

      const partialGain = ctx.createGain();
      // Normalisera mot summan av övertonerna så att tonens toppnivå blir densamma
      // oavsett hur många övertoner spektrumet innehåller.
      partialGain.gain.value = (level * VOICE_PEAK) / PARTIAL_SUM;

      osc.connect(partialGain);
      partialGain.connect(envelope);
      osc.start(now);
      oscillators.push(osc);
    }

    this.voices.set(id, { oscillators, envelope, stopTimer: null });
  }

  /** Släpper en ton med mjuk utklingning. */
  stopVoice(id: string, immediate = false): void {
    const ctx = this.ctx;
    const voice = this.voices.get(id);
    if (!ctx || !voice) {
      return;
    }
    this.voices.delete(id);

    if (voice.stopTimer) {
      clearTimeout(voice.stopTimer);
    }

    const now = ctx.currentTime;
    const release = immediate ? 0.01 : RELEASE;

    try {
      voice.envelope.gain.cancelScheduledValues(now);
      // Fånga upp nivån där den faktiskt är, annars hoppar tonen till full styrka.
      voice.envelope.gain.setValueAtTime(
        Math.max(voice.envelope.gain.value, SILENCE),
        now,
      );
      voice.envelope.gain.exponentialRampToValueAtTime(SILENCE, now + release);
    } catch {
      // Om rampen misslyckas stoppas oscillatorerna ändå nedan.
    }

    for (const osc of voice.oscillators) {
      try {
        osc.stop(now + release + 0.02);
      } catch {
        // Redan stoppad.
      }
    }

    setTimeout(
      () => {
        for (const osc of voice.oscillators) {
          try {
            osc.disconnect();
          } catch {
            // Redan frikopplad.
          }
        }
        try {
          voice.envelope.disconnect();
        } catch {
          // Redan frikopplad.
        }
      },
      (release + 0.15) * 1000,
    );
  }

  stopAllVoices(): void {
    for (const id of [...this.voices.keys()]) {
      this.stopVoice(id);
    }
  }

  /**
   * Spelar en uppsättning toner för kören: antingen samtidigt som ett ackord,
   * eller en i taget så att varje stämma hinner höra sin ton.
   *
   * Tonerna spelas i den ordning de kommer in. Anroparen bestämmer följden,
   * eftersom den kan vara vald av körledaren och inte alltid är efter tonhöjd.
   *
   * En ny tongivning avbryter en pågående, så att två tryck i rad inte lägger
   * sig ovanpå varandra.
   */
  async playTones(
    frequencies: number[],
    options: { mode?: ToneMode; chordDuration?: number; spacing?: number } = {},
  ): Promise<void> {
    this.stopTones();
    await this.ensure();
    const { mode = 'together', chordDuration = 1, spacing = 0.75 } = options;

    const batchId = `tone-${Date.now()}`;
    // Låt tonen klinga nästan hela mellanrummet, med en liten lucka emellan
    // så att stämmorna hörs som skilda toner och inte som ett svep.
    const duration = mode === 'sequence' ? spacing * 0.92 : chordDuration;

    frequencies.forEach((frequency, index) => {
      const delay = mode === 'sequence' ? index * spacing * 1000 : 0;
      const id = `${batchId}-${index}`;
      const timer = setTimeout(() => {
        this.toneTimers.delete(timer);
        this.startVoice(id, frequency);
        const stopTimer = setTimeout(() => {
          this.toneTimers.delete(stopTimer);
          this.stopVoice(id);
        }, duration * 1000);
        this.toneTimers.add(stopTimer);
        this.toneVoiceIds.add(id);
      }, delay);
      this.toneTimers.add(timer);
    });
  }

  /** Avbryter en pågående tongivning direkt. */
  stopTones(): void {
    for (const timer of this.toneTimers) {
      clearTimeout(timer);
    }
    this.toneTimers.clear();
    for (const id of this.toneVoiceIds) {
      this.stopVoice(id);
    }
    this.toneVoiceIds.clear();
  }

  dispose(): void {
    this.stopAllVoices();
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    if (ctx) {
      void ctx.close().catch(() => {});
    }
  }
}

export const audioEngine = new AudioEngine();
