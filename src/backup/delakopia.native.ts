/**
 * Att lämna ut och ta emot kopiefilen — på iOS och Android.
 *
 * Exporten skriver filen till appens tillfälliga katalog och öppnar
 * systemets delningsark. Det är avsiktligt hela lösningen: därifrån når
 * användaren iCloud Drive, mejl, AirDrop och allt annat telefonen kan, utan
 * att appen behöver veta något om någon molntjänst. Väljer man iCloud Drive
 * ligger kopian i Apples moln, synlig på alla enheter — säkerhetskopiering
 * på iOS egen infrastruktur, med användaren vid ratten.
 *
 * Importen går genom systemets filväljare av samma skäl.
 *
 * Webbens motsvarighet i delakopia.ts laddar ner och upp i stället.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function delaKopia(namn: string, innehåll: string): Promise<void> {
  const fil = new File(Paths.cache, namn);
  // En kvarglömd fil från en tidigare export ska inte hindra dagens.
  if (fil.exists) {
    fil.delete();
  }
  fil.write(innehåll);
  await Sharing.shareAsync(fil.uri, {
    mimeType: 'application/json',
    dialogTitle: namn,
  });
}

/** Låter användaren välja en fil och ger dess innehåll. Null vid avbrott. */
export async function väljKopia(): Promise<string | null> {
  const val = await DocumentPicker.getDocumentAsync({
    // JSON-filer, men också päron märkta som äpplen: mejlbilagor och
    // molnfiler bär inte alltid rätt typ, och tolken avvisar ändå fel filer.
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (val.canceled || val.assets.length === 0) {
    return null;
  }
  try {
    return new File(val.assets[0].uri).text();
  } catch {
    return null;
  }
}
