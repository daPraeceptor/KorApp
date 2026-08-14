# Stressprov

Enhetstesterna i `src/` provar att koden gör rätt. De här proven gör tvärtom:
de matar den med sådant ingen körledare skulle göra, och mäter var den ger
efter. Flera av dem **misslyckas med flit** — de bokför brister som inte är
åtgärdade än, och blir gröna först när bristen är borta.

```bash
node --test stress/*.stress.ts     # eller: npm run test:stress
```

| Fil | Vad det stressar |
| --- | --- |
| `metronom.stress.ts` | Klockan hoppar, fliken stryps, en timme i högsta tempo, ständiga ändringar under gång, trasiga tempovärden |
| `ordning.stress.ts` | Vad som händer med redan bokade klick när underdelningen byts mitt i ett taktslag |
| `lagring.stress.ts` | 20 000 slumpade poster genom `normalizeSong`, trasig JSON, 20 000 omflyttningar mellan mappar, 100 000 tangenttryck |
| `skala.stress.ts` | Bibliotek på 100–2000 låtar: sortering, sökning, sparning, och hur mycket en dragning skriver till lagringen |
| `ljud.stress.ts` | Alla 128 toner × 12 tonikor, alla 4096 tonkombinationer genom ackordanalysen, klangfärgernas nivåer, knacktempo, taktvisarens ytterlägen |
