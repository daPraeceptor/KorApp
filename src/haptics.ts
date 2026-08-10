/**
 * Känselsvar (haptik) samlat på ett ställe.
 *
 * Telefonen svarar med en liten stöt när något griper tag, byter plats eller
 * slår om — det är så iOS bekräftar en gest utan att låta. Webben har inget
 * motsvarande och tiger, och den som inte vill känna av det stänger av det
 * i inställningarna.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

let påslagen = true;

/** Följer inställningen. Sätts av AppState när värdet ändras. */
export function setHapticsEnabled(value: boolean): void {
  påslagen = value;
}

function av(): boolean {
  return !påslagen || Platform.OS === 'web';
}

export const haptik = {
  /** Ett steg i en följd: tempohjulet, en ny plats i listan. */
  val(): void {
    if (av()) return;
    void Haptics.selectionAsync().catch(() => {});
  },
  /** Lätt knäpp: något slog om eller släpptes. */
  lätt(): void {
    if (av()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** Tyngre knäpp: greppet tog tag, kortet lyftes. */
  medel(): void {
    if (av()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  /** Bekräftelse: låset slog till, något gick i lås. */
  klar(): void {
    if (av()) return;
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
  },
  /** Varning: något togs bort. */
  varning(): void {
    if (av()) return;
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
  },
};
