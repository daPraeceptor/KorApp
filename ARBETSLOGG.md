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
- Fälla: skärmfilerna har CRLF, strängersättning med `\n` missar. Använd Edit.
- `npm test`: 193/193. `npm run test:stress`: 22/22. `tsc --noEmit` rent.

## Återstår

Webben: ta bort `app.js-passenger-av`, `.htaccess` med https och säkerhetshuvuden.

### Webben

- `public/.htaccess`: `Options -Indexes`, http→https (med vakt mot
  X-Forwarded-Proto-slinga), HSTS 1 år, nosniff, `Referrer-Policy: no-referrer`,
  Permissions-Policy, X-Frame-Options DENY och CSP. `expo export` kopierar
  punktfilen till `dist/` — kontrollerat.
- Bundlen: två `eval`, båda i reservvägar (Metros asynkrona laddning, crypto
  utan fönster). `script-src 'self'` räcker. `style-src` behöver `'unsafe-inline'`.
- `verktyg/prova-csp.mjs` (`npm run prova:csp`): läser CSP ur `.htaccess`,
  serverar bygget med den, Chrome går igenom flikarna och trycker en tangent med
  flygeln vald. Resultat: 17 pianoprov hämtade, inget stoppat.
  `UTAN_CSP=1` ger kontrollkörning utan policy.
- Fälla: webben börjar i körtonen, och `parseSettings` ställer tillbaka klangen
  om `migrationer` saknas. Provet måste skriva `migrationer: 99` för att flygeln
  ska stå kvar. Första körningarna gav 0 prov, också utan CSP — felet låg i provet.
- På servern låg också `index-7b68….js` i rotkatalogen (första deployen, 4 aug).
- `skicka-till-webben.sh` steg 1 döpte om `.htaccess` → skulle ha döpt bort den
  nya vid varje deploy. Ersatt med: ta bort `app.js-passenger-av` och
  `index-*.js` i roten. `.htaccess-passenger-av` får ligga (403). Steg 3
  kontrollerar nu säkerhetshuvudena och http-omdirigeringen.
- Fälla: `String.replace` med `$'` i ersättningstexten förstörde skriptet
  (`$'` = texten efter träffen). Återställt med git checkout, gjort om med Edit.
