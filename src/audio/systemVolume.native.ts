/**
 * Telefonens egen ljudnivå — den som ställs med knapparna på sidan.
 *
 * iOS rapporterar bara *ändringar*, aldrig ett utgångsvärde: bevakningen
 * sätts upp med KVO utan «initial»-flagga. Appen vet därför inte hur högt
 * telefonen står förrän någon rör knapparna, och varningen kan bara visas
 * när nivån faktiskt är känd.
 *
 * Bevakningen fungerar inte i simulatorn, bara på en riktig telefon.
 */
import { AudioManager } from 'react-native-audio-api';

export function observeSystemVolume(
  onChange: (volume: number) => void,
): () => void {
  try {
    AudioManager.observeVolumeChanges(true);
    const prenumeration = AudioManager.addSystemEventListener(
      'volumeChange',
      ({ value }: { value: number }) => onChange(value),
    );
    return () => {
      prenumeration.remove();
      AudioManager.observeVolumeChanges(false);
    };
  } catch {
    // Saknas stödet är det ingen katastrof: varningen uteblir bara.
    return () => {};
  }
}
