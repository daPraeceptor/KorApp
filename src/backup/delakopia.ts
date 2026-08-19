/**
 * Att lämna ut och ta emot kopiefilen — på webben.
 *
 * Exporten blir en vanlig nedladdning, importen en filväljare. Motsvarigheten
 * för iOS och Android ligger i delakopia.native.ts och går genom systemets
 * delningsark, där iCloud Drive, mejl och AirDrop bor.
 */

export async function delaKopia(namn: string, innehåll: string): Promise<void> {
  const blob = new Blob([innehåll], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const länk = document.createElement('a');
  länk.href = url;
  länk.download = namn;
  länk.click();
  // Adressen pekar på minne som inte släpps av sig självt. En kort frist så
  // att nedladdningen hinner börja innan den dras undan.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Låter användaren välja en fil och ger dess innehåll. Null vid avbrott. */
export function väljKopia(): Promise<string | null> {
  return new Promise((klar) => {
    const väljare = document.createElement('input');
    väljare.type = 'file';
    väljare.accept = 'application/json,.json';
    väljare.onchange = () => {
      const fil = väljare.files?.[0];
      if (!fil) {
        klar(null);
        return;
      }
      fil.text().then(klar, () => klar(null));
    };
    // Stängd dialog utan val ger ingen händelse alls i vissa webbläsare;
    // cancel-händelsen fångar de som säger till.
    väljare.oncancel = () => klar(null);
    väljare.click();
  });
}
