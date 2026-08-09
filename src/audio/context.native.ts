/**
 * Ljudkontext för iOS och Android via react-native-audio-api.
 *
 * Biblioteket implementerar Web Audio-API:t, så typerna och all logik ovanför
 * det här lagret delas med webbversionen i context.ts.
 */
import { AudioContext, AudioManager } from 'react-native-audio-api';

import { beskrivFel, logAudio } from './diagnostics';

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
    logAudio('Session: inställd (playback, mixWithOthers)');
    void AudioManager.setAudioSessionActivity(true)
      .then(() => logAudio('Session: aktiverad'))
      .catch((fel: unknown) => {
        // Ett tyst fel här kostade en hel utgåva. Nu syns det i diagnostiken.
        logAudio(`Session: aktivering MISSLYCKADES — ${beskrivFel(fel)}`);
      });
  } catch (fel) {
    logAudio(`Session: inställning MISSLYCKADES — ${beskrivFel(fel)}`);
  }
}

export function createAudioContext(): AudioContextLike {
  configureAudioSession();
  try {
    const ctx = new AudioContext() as unknown as AudioContextLike;
    logAudio(`Kontext: skapad (state=${ctx.state}, ${ctx.sampleRate} Hz)`);
    return ctx;
  } catch (fel) {
    logAudio(`Kontext: kunde INTE skapas — ${beskrivFel(fel)}`);
    throw fel;
  }
}

export async function unlockAudioContext(ctx: AudioContextLike): Promise<void> {
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      logAudio(`Kontext: väckt (state=${ctx.state})`);
    } catch (fel) {
      logAudio(`Kontext: väckning MISSLYCKADES — ${beskrivFel(fel)}`);
      throw fel;
    }
  }
}
