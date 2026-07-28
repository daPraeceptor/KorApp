/**
 * Ljudkontext för iOS och Android via react-native-audio-api.
 *
 * Biblioteket implementerar Web Audio-API:t, så typerna och all logik ovanför
 * det här lagret delas med webbversionen i context.ts.
 */
import { AudioContext, AudioManager } from 'react-native-audio-api';

export type {
  AudioParamLike,
  AudioNodeLike,
  GainNodeLike,
  BiquadFilterNodeLike,
  OscillatorNodeLike,
  AudioContextLike,
} from './context';

import type { AudioContextLike } from './context';

let sessionConfigured = false;

/**
 * Låter appen spela även när telefonens ringsignal är avstängd — annars är
 * appen tyst för alla som har ljudet nedskruvat, vilket är vanligt i kyrkor.
 */
function configureAudioSession(): void {
  if (sessionConfigured) {
    return;
  }
  sessionConfigured = true;
  try {
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosOptions: ['mixWithOthers', 'defaultToSpeaker'],
    });
    void AudioManager.setAudioSessionActivity(true).catch(() => {});
  } catch {
    // Ljudsessionen är en optimering; appen fungerar även om den inte kan sättas.
  }
}

export function createAudioContext(): AudioContextLike {
  configureAudioSession();
  return new AudioContext() as unknown as AudioContextLike;
}

export async function unlockAudioContext(ctx: AudioContextLike): Promise<void> {
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}
