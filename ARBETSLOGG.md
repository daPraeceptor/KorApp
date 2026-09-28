# Arbetslogg — session 2026-09-28

## Vad sessionen gör

Peter: ”Kolla säkerheten på appen. Finns det hål vi kan täppa igen?”

## Utgångsläge

- master på `aab4ce4` (Låt appen fylla webbläsarens fönster), rent arbetsträd.
- Webben på korapp.huleteknik.se serverar bundlen `index-bb7c9b76….js`, samma som i `dist/`.

## Vad som kontrollerats

**Appen själv.** Inga nätverksanrop utom `fetch` av pianoproven (egna filer) och
en `Linking.openURL` till en fast CC-adress. Ingen `eval`, ingen `innerHTML`,
inga hemligheter i repot (`.gitignore` täcker nycklar; FTP-inloggningen ligger i
`../_netrc_kormetronom`, utanför projektet). Enda vägen in för främmande data är
inläsningen av en bibliotekskopia (`src/backup/bibliotekskopia.ts`). Den går genom
`parseLibrary`/`parseFolders`, använder `Map`/`Set` (ingen prototypförorening),
och klämmer alla tal. Bra.

**Hål 1 — biblioteket kan skrivas över med tomt vid en misslyckad läsning.**
`AppState.tsx` ~rad 300: inläsningen har `try … finally` utan `catch`. Kastar
`AsyncStorage.getItem` sätts `loaded = true` ändå, med `songs = []` från
`useState`, och den fördröjda sparningen skriver `[]` över det riktiga biblioteket.
På Android kastar `getItem` om en rad är större än ~2 MB (CursorWindow). Kopians
fält saknar längdgränser (titel, anteckningar, id, antal låtar), så en stor eller
illvillig kopiefil kan: läsas in → sparas → ge kastat fel vid nästa start → radera
biblioteket. Motsäger modulens egen löfte att en fil aldrig kan skada biblioteket.

**Hål 2 — `updatedAt` från filen litas på.** En kopia med `updatedAt` långt i
framtiden vinner över alla senare lokala ändringar av samma id vid varje ny import.
Litet, men lätt att klämma till `Date.now()` vid inläsning.

**Webben.**
- `https://korapp.huleteknik.se/app.js-passenger-av` går att ladda ner (Passengers
  exempelapp, 13 rader, inget känsligt — men bör bort).
- `http://` svarar 200 i stället för att skicka vidare till `https://`. Ingen HSTS.
- Inga säkerhetshuvuden: ingen CSP, `X-Content-Type-Options`, `frame-ancestors`,
  `Referrer-Policy`.
- Katalogläsning är avstängd (403), `.htaccess`/`.git` ger 403. Bra.

**Beroenden.** `npm audit --omit=dev`: 15 (4 höga). Alla sitter i byggverktygen
(`@expo/cli`, `@expo/config-plugins`, xmldom, js-yaml, image-size, brace-expansion,
uuid via xcode) — inget av det hamnar i appen eller webbundlen. Löses bäst med
nästa Expo-uppdatering, inte `--force`.

## Beslut: Peter sa ”Fixa alla!”

### Appen (klart, testat)

- `AppState.tsx`: ny flagga `lagringenLäst`, sätts bara när läsningen lyckas.
  Sparningen följer den i stället för `loaded`. `loaded` sätts fortfarande i
  `finally` så att gränssnittet (startfliken i App.tsx) inte fastnar.
- `songs.ts`: `MAX_TITEL` 200, `MAX_MAPPNAMN` 100, `MAX_ANTECKNINGAR` 2000,
  `MAX_ID` 64. Titlar/namn/anteckningar kortas, för långa id faller bort,
  för långt `folderId` blir null. Appens egna id är ~15–30 tecken.
- `bibliotekskopia.ts`: fil > 1 000 000 tecken avvisas före `JSON.parse`;
  högst 2000 låtar och 200 mappar per fil.
- `updatedAt`: första försöket var att korta framtida tider till `nu`. Provet
  visade felet — ”nu” flyttar sig, så samma fil vann igen vid nästa import.
  Nu: mer än ett dygn fram räknas som 0 (äldst). Ett dygn för klockor som går
  olika på två telefoner.
- `maxLength` på titel- och mapprutorna.
- Fälla: `python3 - <<EOF || node - <<EOF2` — python3 finns och körde det tomma
  skriptet, så node kördes aldrig. Skriv skripten till fil och kör med node.
- Fälla: skärmfilerna har CRLF, strängersättning med 
 missar. Använd Edit.
- `npm test`: 193/193. `npm run test:stress`: 22/22. `tsc --noEmit` rent.

## Återstår

Webben: ta bort `app.js-passenger-av`, `.htaccess` med https och säkerhetshuvuden.
