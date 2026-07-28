# Körmetronom

Metronom och tongivare för körledare. Byggd med Expo (React Native), så samma
kodbas blir både en iPhone-app och en Android-app — och kan köras i webbläsaren
under utvecklingen.

## Vad appen gör

- **Snurrhjul för tempo.** Vrid hjulet med fingret, eller använd knacktempo och
  finjustering med ±1. Området är 30–300 slag per minut.
- **Metronom med taktart och underdelning.** Accent på ettan, valfritt antal slag
  per takt, och underdelning i åttondelar, trioler eller sextondelar.
- **Klaviatur som ger kören toner.** Tryck för att spela. **Dubbeltryck på en
  tangent för att göra den till tonika** — tangenten markeras och blir referens
  för den rena stämningen. Att bara hålla ned en tangent spelar tonen länge, som
  man vill när kören ska hinna höra den.
- **Tempererad och ren stämning.** Tempererad är som ett piano. Ren stämning
  bygger varje intervall på en heltalskvot relativt tonikan, så att övertonerna
  sammanfaller och svävningarna försvinner.
- **Tongivning på fyra sätt.** Hela ackordet på en gång, en i taget nedifrån och
  upp, uppifrån och ner, eller i den ordning tonerna valdes. Hastigheten sparas
  per låt.
- **Bevarad tonordning.** Tonerna sparas alltid i den följd de valdes, till
  exempel stämmornas insatsordning, och sorteras varken vid inläsning eller
  uppspelning. Knapparna avgör i vilken ordning de faktiskt ges.
- **Grafisk taktvisare.** Klassisk pendel, streck som går fram och tillbaka,
  eller boll som studsar mot marken — bollen studsar högre vid långsamma tempon
  och lägre vid snabba. Animeringen räknas från när taktslaget hördes, så bilden
  följer ljudet i stället för att glida ur fas.
- **Valbara tonnamn.** Bokstäver, solmisation (do re mi) eller tonplatser som
  romerska siffror. De två senare kan räknas fast från C, eller flyttbart från
  tonikan så att tonikan alltid blir do respektive I. Namnen går att dölja helt.
- **Låtbibliotek.** Varje låt sparar tempo, taktart, stämning, tonika,
  starttoner och tongivningens hastighet. Direkt i listan finns knappar för att
  starta låtens tempo och ge dess toner, utan att gå via spelvyn.
- **Svenska eller internationella tonnamn.** Internationellt (B) är standard;
  svenskt (H) går att välja i inställningarna.

## Kom igång

```bash
npm install
```

Kör i webbläsaren under utveckling:

```bash
npm run web
```

Kör på din egen telefon: installera **Expo Go** från App Store eller Google Play,
kör `npm start` och skanna QR-koden. Telefonen och datorn måste vara på samma
nätverk.

> Klaviaturen och metronomen fungerar i Expo Go, men ljudmotorn
> (`react-native-audio-api`) är en native-modul. För full ljudprestanda och för
> att lägga appen i butikerna behövs ett eget bygge, se nedan.

## Bygga för App Store och Google Play

Expos molnbyggen kompilerar iOS-appen åt dig, så du behöver ingen Mac:

```bash
npx eas build --platform ios
npx eas build --platform android
```

## Tester

Stämningsmatematiken och tempoberäkningen är enhetstestade:

```bash
npm test
```

## Så är koden organiserad

| Sökväg | Innehåll |
| --- | --- |
| `src/theory/tuning.ts` | Tonhöjder, tempererad och ren stämning, cent och intervallnamn |
| `src/audio/context.ts` | Ljudkontext för webben |
| `src/audio/context.native.ts` | Samma gränssnitt för iOS och Android |
| `src/audio/engine.ts` | Metronomklick och tonsyntes |
| `src/audio/metronome.ts` | Schemaläggning av taktslag |
| `src/audio/tempo.ts` | Tempogränser och knacktempo |
| `src/store/songs.ts` | Låtmodellen och inläsning från lagring |
| `src/state/AppState.tsx` | Delat tillstånd och persistens |
| `src/components/` | Snurrhjul, klaviatur, taktvisare och gemensamma byggstenar |
| `src/screens/` | Spela, Låtar, Inställningar |

Ljudlogiken är skriven mot Web Audio-API:t en enda gång. På webben används
webbläsarens egen implementation och på telefonen `react-native-audio-api`, som
implementerar samma API — därför delas all schemaläggning och tonsyntes mellan
plattformarna.

## Om den rena stämningen

Tonikan förankras på sin tempererade frekvens, så att den låter likadant oavsett
stämningssystem. Övriga toner räknas ut som heltalskvoter därifrån:

| Intervall | Kvot | Avvikelse mot piano |
| --- | --- | --- |
| Stor sekund | 9/8 | +3,9 cent |
| Liten ters | 6/5 | +15,6 cent |
| Stor ters | 5/4 | −13,7 cent |
| Kvart | 4/3 | −2,0 cent |
| Kvint | 3/2 | +2,0 cent |
| Stor sext | 5/3 | −15,6 cent |

En durtreklang får då frekvenskvoterna 4:5:6, vilket är det som gör ackordet
svävningsfritt. Med F som tonika blir A:t 436,5 Hz i stället för 440 Hz.

### Varför tonen har sex övertoner

Svävningen i en stor ters uppstår mellan grundtonens **femte** överton och
tersens fjärde. En ton som bara byggs av de fyra första övertonerna innehåller
därför ingen hörbar skillnad mellan tempererad och ren ters, hur exakt
frekvenserna än är räknade — skillnaden finns i matematiken men inte i ljudet.

Med sex övertoner får en tempererad C-durtreklang svävningar på 0,9 Hz, 10,4 Hz
och 17,8 Hz, medan den rena har noll: fyra deltonspar sammanfaller då på exakt
samma frekvens.
