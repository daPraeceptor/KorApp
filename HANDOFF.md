# Handoff

## Läget

Säkerhetsgenomgång 2026-09-28, allt som hittades är åtgärdat. Detaljer och
fällor i `ARBETSLOGG.md`. Expo är uppdaterat till 57.0.26 (react-native 0.86.3). Webben är deployad;
iOS-appen har ändringarna i koden men inte i något bygge än.

## Klart

- **Biblioteket kan inte längre tömmas av en misslyckad läsning**
  (`src/state/AppState.tsx`, flaggan `lagringenLäst` styr sparningen).
- **Gränser för inlästa kopior** (`src/backup/bibliotekskopia.ts`,
  `src/store/songs.ts`): filstorlek 1 MB, 2000 låtar, 200 mappar, textlängder,
  id-längd. Ändringstid mer än ett dygn fram räknas som 0. `maxLength` på rutorna.
- **Webben** (`public/.htaccess`): https-omdirigering, HSTS, CSP, nosniff,
  inget inbäddande, ingen kataloglistning. Prövas med `npm run prova:csp`
  (kräver `npm run bygg:webb` först). Ändra CSP bara i `.htaccess` — provet läser
  den därifrån.
- **Deployen** (`skicka-till-webben.sh`) tar bort Passengers rester och kontrollerar
  att säkerhetshuvudena och omdirigeringen fungerar.

## Öppet

- Nytt iOS-bygge för att appdelen ska nå användarna. Peter kör det själv
  (`bash bygg-ios.sh`).
- `npm audit`: 12 kvar (1 hög, image-size), alla i Expos byggverktyg. Expo
  uppdaterat till 57.0.26 den 2026-09-29. Aldrig `--force` — det nedgraderar Expo.

## Tänk på

- Ändras CSP:n eller läggs något externt till (typsnitt, analys, CDN) måste
  `public/.htaccess` uppdateras och `npm run prova:csp` köras innan deploy.
