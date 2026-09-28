# Handoff

## Läget

Säkerhetsgenomgång gjord 2026-09-28 på `aab4ce4`, inget ändrat i koden. Detaljer
i `ARBETSLOGG.md`. Appen är i grunden sund: inget nätverk, inga hemligheter i
repot, inläsning av kopior går genom fuzz-testade tolkar.

## Öppet (i prioritetsordning)

1. **Datafallet i `src/state/AppState.tsx` (~rad 300):** kastar
   `AsyncStorage.getItem` sparas ett tomt bibliotek över det riktiga. Lägg till en
   `catch` som *inte* sätter `loaded`, så att inga skrivningar görs den sessionen.
2. **Längdgränser i `normalizeSong`/`normalizeFolder`** (`src/store/songs.ts`):
   korta titel, anteckningar, id, mappnamn; tak på antal låtar/mappar och på
   filstorleken före `JSON.parse` i `läsInKopia`.
3. **Kläm `updatedAt`** till högst `Date.now()` vid import.
4. **Webben:** ta bort `app.js-passenger-av`; lägg en `.htaccess` i `public/` med
   http→https, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, CSP med
   `frame-ancestors 'none'`. Kräver kontroll att Expo-bundlen tål CSP:n
   (blob:-URL:er för export, `'unsafe-inline'` för style-taggen).
5. **npm audit:** bara byggverktyg; vänta på Expo-uppdatering.

## Nästa steg

Peter väljer vilka punkter som görs. iOS-bygget kör Peter själv; webbdeployen
(`bash skicka-till-webben.sh`) kör Claude.
