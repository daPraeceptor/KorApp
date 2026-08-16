/**
 * Rotationslåset på iOS och Android.
 *
 * Låser till stående, eller släpper fritt. Modulen laddas först när den
 * behövs: den är en native-modul, och det finns ingen anledning att dra in
 * den förrän någon faktiskt ändrar läge.
 */
import * as ScreenOrientation from 'expo-screen-orientation';

export async function ställRotation(tillåt: boolean): Promise<void> {
  try {
    if (tillåt) {
      await ScreenOrientation.unlockAsync();
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  } catch {
    // Vissa enheter vägrar låsa — en iPad utan helskärmsläge, till exempel.
    // Att skärmen vrider sig ändå är inget att avbryta appen för.
  }
}
