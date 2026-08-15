/**
 * Ljudmotor: metronomklick och tonsyntes för körens starttoner.
 *
 * All schemaläggning sker mot ljudkortets egen klocka (ctx.currentTime) i stället
 * för JavaScript-timers, eftersom timers driver iväg så fort appen får annat att göra.
 */
import {
  type AudioContextLike,
  type GainNodeLike,
  type OscillatorNodeLike,
  createAudioContext,
  unlockAudioContext,
} from './context.ts';
import { DEFAULT_TIMBRE, TIMBRES, type TimbreId } from './timbres.ts';

/** Nivå som exponentiella ramper går mot i stället för noll, som de inte klarar. */
const SILENCE = 0.0001;

/** Toppnivå för en ensam ton. */
const VOICE_PEAK = 0.5;

/**
 * Så högt tongivningen får nå tillsammans, hur många toner som än ljuder.
 *
 * Toner startade i samma ögonblick börjar alla på fasen noll, och deras
 * deltoner ligger därför i fas i anslaget. Ett ackord toppar alltså på nära
 * summan av tonernas nivåer — ett åttastämmigt på fyra gånger full
 * utstyrning, vilket klipper hårt och hörbart. Därför får tonbussen bära
 * ett tak, och tonernas nivå räknas ner mot det när de blir fler.
 */
const TONE_CEILING = 0.85;

/**
 * Nivån varje ton ska ligga på när så här många ljuder samtidigt.
 *
 * En ensam ton rör sig inte ur fläcken: det vanligaste fallet ska låta
 * precis som förut. Först när tonerna blir flera räknas de ner, och då bara
 * så mycket som krävs för att summan ska hålla sig under taket.
 */
export function tonbussNivå(antalRöster: number): number {
  // Ett tal som inte är ett tal överlever både Math.max och Math.round, och
  // en nivå på NaN gör ljudmotorn tyst i stället för svagare.
  const röster = Number.isFinite(antalRöster)
    ? Math.max(1, Math.round(antalRöster))
    : 1;
  return Math.min(VOICE_PEAK, TONE_CEILING / röster);
}

/** Deltoner ovanför hörselområdet hoppas över, de ger bara vikning. */
const NYQUIST_GUARD = 18000;

interface Voice {
  /** Allt som måste stoppas: oscillatorer såväl som buffertspelare. */
  källor: { stop(when?: number): void }[];
  /** Allt som ska kopplas loss när tonen tystnat. */
  noder: { disconnect(): void }[];
  envelope: GainNodeLike;
  stopTimer: ReturnType<typeof setTimeout> | null;
  /** Utklingningstiden hör till klangen tonen startades med. */
  release: number;
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
  /**
   * Alla toner går genom en egen buss, metronomklicken förbi den. Det är på
   * bussen tonernas gemensamma nivå räknas ner när de blir flera — klicken
   * ska höras lika starkt vare sig kören just fått sina toner eller inte.
   */
  private toneBus: GainNodeLike | null = null;
  private voices = new Map<string, Voice>();
  /** Toner som släppts men ännu klingar ut. De räknas med i nivån. */
  private utklingande = 0;
  private volume = 0.8;
  private timbreId: TimbreId = DEFAULT_TIMBRE;
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
      this.toneBus = this.ctx.createGain();
      this.toneBus.gain.value = 1;
      this.toneBus.connect(this.master);
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

  /** Klangen som nya toner startas med. Redan klingande toner behåller sin. */
  setTimbre(id: TimbreId): void {
    this.timbreId = TIMBRES[id] ? id : DEFAULT_TIMBRE;
  }

  /**
   * Hämtar hem det den valda klangen behöver för att kunna ljuda.
   *
   * Klanger byggda av oscillatorer behöver ingenting och blir klara direkt.
   * De som spelar inspelade prov måste hämta dem först, och det ska ske när
   * klangen väljs — inte när körledaren trycker på en tangent.
   */
  async förberedKlang(): Promise<void> {
    const timbre = TIMBRES[this.timbreId] ?? TIMBRES[DEFAULT_TIMBRE];
    if (!timbre.förbered) {
      return;
    }
    const ctx = await this.ensure();
    await timbre.förbered(ctx);
  }

  /**
   * Ställer tonbussen efter hur många toner som ljuder.
   *
   * Ändringen glider över ett par hundradels sekund. Ett hopp i nivån mitt i
   * en klingande ton skulle höras som ett knäpp, och en långsam glidning som
   * en tonstyrka som svajar — det här ligger mitt emellan, och märks som att
   * ett ackord helt enkelt är lika starkt som en ensam ton.
   */
  private uppdateraTonbuss(): void {
    const ctx = this.ctx;
    const buss = this.toneBus;
    if (!ctx || !buss) {
      return;
    }
    const röster = this.voices.size + this.utklingande;
    const nivå = röster === 0 ? 1 : tonbussNivå(röster) / VOICE_PEAK;
    const nu = ctx.currentTime;
    try {
      buss.gain.cancelScheduledValues(nu);
      buss.gain.setValueAtTime(buss.gain.value, nu);
      buss.gain.linearRampToValueAtTime(nivå, nu + 0.03);
    } catch {
      buss.gain.value = nivå;
    }
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
    const buss = this.toneBus;
    if (!ctx || !buss) {
      return;
    }

    this.stopVoice(id, true);

    const timbre = TIMBRES[this.timbreId] ?? TIMBRES[DEFAULT_TIMBRE];
    // Klangens egen styrka, så att en flygelton och en körton upplevs lika
    // starka trots att deras vågformer är helt olika täta.
    const toppnivå = VOICE_PEAK * (timbre.nivå ?? 1);

    const now = ctx.currentTime;

    // Klanger som inte går att beskriva som en hög sinustoner — de som
    // moduleras eller spelas ur ett inspelat prov — bygger sin egen ljudgraf
    // och lämnar tillbaka den att hänga under enveloppen. Bygget görs före
    // enveloppen: säger klangen nej, för att den ännu väntar på sina prov,
    // ska inga noder bli hängande efter sig.
    const bygge = timbre.bygg ? timbre.bygg(ctx, frequency, now, toppnivå) : null;
    if (timbre.bygg && !bygge) {
      return;
    }

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(SILENCE, now);
    envelope.gain.linearRampToValueAtTime(1, now + timbre.attack);
    envelope.gain.linearRampToValueAtTime(
      Math.max(timbre.sustain, SILENCE),
      now + timbre.attack + timbre.decay,
    );
    envelope.connect(buss);

    if (bygge) {
      bygge.utgång.connect(envelope);
      for (const källa of bygge.källor) {
        källa.start(now);
      }
      this.voices.set(id, {
        källor: bygge.källor,
        noder: [...bygge.noder, envelope],
        envelope,
        stopTimer: null,
        release: timbre.release,
      });
      this.uppdateraTonbuss();
      return;
    }

    const partials = timbre
      .partials(frequency)
      .filter((partial) => frequency * partial.ratio <= NYQUIST_GUARD);
    // Normalisera mot summan så att tonens toppnivå blir densamma oavsett hur
    // många deltoner klangen råkar bestå av.
    const partialSum = partials.reduce((sum, partial) => sum + partial.gain, 0) || 1;

    const oscillators: OscillatorNodeLike[] = [];
    const partialGains: GainNodeLike[] = [];
    for (const partial of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency * partial.ratio, now);

      const level = (partial.gain * toppnivå) / partialSum;
      const partialGain = ctx.createGain();
      partialGain.gain.setValueAtTime(level, now);

      // Anslagsklanger låter varje delton klinga av för sig, med de ljusa
      // först. Det är den utvecklingen som skiljer ett anslag från en orgelton.
      if (timbre.partialDecay) {
        const span = timbre.partialDecay * (partial.decayScale ?? 1);
        try {
          partialGain.gain.exponentialRampToValueAtTime(
            Math.max(level * 0.02, SILENCE),
            now + span,
          );
        } catch {
          // Klarar ljudmotorn inte rampen låter deltonen ligga kvar på sin nivå.
        }
      }

      osc.connect(partialGain);
      partialGain.connect(envelope);
      osc.start(now);
      oscillators.push(osc);
      partialGains.push(partialGain);
    }

    this.voices.set(id, {
      källor: oscillators,
      noder: [...oscillators, ...partialGains, envelope],
      envelope,
      stopTimer: null,
      release: timbre.release,
    });
    this.uppdateraTonbuss();
  }

  /** Släpper en ton med mjuk utklingning. */
  stopVoice(id: string, immediate = false): void {
    const ctx = this.ctx;
    const voice = this.voices.get(id);
    if (!ctx || !voice) {
      return;
    }
    this.voices.delete(id);
    // Tonen är släppt men hörs fortfarande. Räknades den bort redan nu skulle
    // bussen höjas mitt i utklingningen, och kvarvarande toner skulle svälla.
    this.utklingande += 1;

    if (voice.stopTimer) {
      clearTimeout(voice.stopTimer);
    }

    const now = ctx.currentTime;
    const release = immediate ? 0.01 : voice.release;

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

    for (const källa of voice.källor) {
      try {
        källa.stop(now + release + 0.02);
      } catch {
        // Redan stoppad.
      }
    }

    setTimeout(
      () => {
        for (const nod of voice.noder) {
          try {
            nod.disconnect();
          } catch {
            // Redan frikopplad.
          }
        }
        this.utklingande = Math.max(0, this.utklingande - 1);
        this.uppdateraTonbuss();
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
    // Väntar in prov som ännu inte hämtats, så att första tongivningen efter
    // ett klangbyte hörs som alla andra.
    await this.förberedKlang();
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
    this.toneBus = null;
    this.utklingande = 0;
    if (ctx) {
      void ctx.close().catch(() => {});
    }
  }
}

export const audioEngine = new AudioEngine();
