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
 * Ställer in ljudsessionen på iOS.
 *
 * Kategorin "playback" låter appen spela även när ringsignalen är avstängd —
 * annars är appen tyst för alla som har ljudet nedskruvat, vilket är vanligt
 * i kyrkor. Den skickar också ljudet till högtalaren av sig själv.
 *
 * Lägg inte till "defaultToSpeaker" här. Det alternativet gäller bara
 * kategorin "playAndRecord", och iOS avvisar hela anropet när det kombineras
 * med "playback". Sessionen konfigureras då aldrig, och eftersom biblioteket
 * avbryter aktiveringen när konfigurationen misslyckas blev appen helt tyst.
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
      iosOptions: ['mixWithOthers'],
    });
    void AudioManager.setAudioSessionActivity(true).catch((fel: unknown) => {
      // Ett tyst fel här kostade en hel utgåva. Nu syns det åtminstone i loggen.
      console.warn('Ljudsessionen kunde inte aktiveras', fel);
    });
  } catch (fel) {
    console.warn('Ljudsessionen kunde inte ställas in', fel);
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
