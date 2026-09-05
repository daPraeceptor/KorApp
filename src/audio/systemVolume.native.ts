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
      // Slå inte av bevakningen. AudioManager.observeVolumeChanges(false)
      // kraschar appen, och den här städningen körs bara i det ögonblick då
      // appen ändå dör.
      //
      // Biblioteket registrerar KVO-bevakningen på AVAudioSession med en egen
      // context men avregistrerar den med context nil
      // (SystemNotificationManager.mm rad 62-67). Cocoa hittar då ingen
      // matchande registrering och kastar ett Objective-C-undantag. Det
      // kastas på bibliotekets egen kö, com.swmansion.audioapi
      // .MainModuleQueue, långt utanför den här funktionens anropsstack, så
      // ingen try/catch i JavaScript kan fånga det. Undantaget går ofångat
      // hela vägen ut och blir SIGABRT.
      //
      // Städningen hör till en useEffect med tom beroendelista i AppState,
      // så den körs först när React river hela trädet. På iOS sker det när
      // systemet stänger appen, alltså precis när användaren sveper bort den
      // i appväxlaren. Därför såg det ut som att appen kraschade av att bli
      // dödad, oavsett om något ljud hördes.
      //
      // Att lämna bevakningen på kostar ingenting: processen avslutas i
      // nästa andetag och operativsystemet tar hand om resten.
    };
  } catch {
    // Saknas stödet är det ingen katastrof: varningen uteblir bara.
    return () => {};
  }
}
