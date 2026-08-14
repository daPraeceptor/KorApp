/**
 * Ljudkontext för webben.
 *
 * Motsvarigheten för iOS och Android ligger i context.native.ts och använder
 * react-native-audio-api, som implementerar samma Web Audio-API. Därför kan
 * all ljudlogik ovanför det här lagret delas mellan plattformarna.
 */

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): unknown;
  linearRampToValueAtTime(value: number, endTime: number): unknown;
  exponentialRampToValueAtTime(value: number, endTime: number): unknown;
  cancelScheduledValues(cancelTime: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: any): any;
  disconnect(): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: any;
  readonly frequency: AudioParamLike;
  readonly Q: AudioParamLike;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: any;
  readonly frequency: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
}

/** Färdigräknat ljud, en kanal i taget. */
export interface AudioBufferLike {
  readonly length: number;
  readonly sampleRate: number;
  getChannelData(channel: number): Float32Array;
  copyToChannel?(source: Float32Array, channelNumber: number): void;
}

export interface AudioBufferSourceNodeLike extends AudioNodeLike {
  buffer: any;
  readonly playbackRate: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: any;
  readonly state: string;
  readonly sampleRate: number;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorNodeLike;
  createBiquadFilter(): BiquadFilterNodeLike;
  /** Skapar en tom ljudbuffert att räkna in ljud i. */
  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): AudioBufferLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  resume(): Promise<void>;
  close(): Promise<void>;
}

export function createAudioContext(): AudioContextLike {
  const Ctor =
    (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
  if (!Ctor) {
    throw new Error('Web Audio API saknas i den här webbläsaren.');
  }
  return new Ctor() as AudioContextLike;
}

/**
 * Webbläsare startar ljudkontexten i pausat läge tills användaren interagerat.
 * Anropas därför före varje ljud som en användarhandling utlöst.
 */
export async function unlockAudioContext(ctx: AudioContextLike): Promise<void> {
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}
