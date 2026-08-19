/**
 * Appens alla texter, på svenska.
 *
 * Det här är förlagan: strukturen här definierar vilka nycklar som finns,
 * och den engelska ordlistan i texter.en.ts är typad mot den — en text som
 * saknas på engelska blir ett kompileringsfel, inte en svensk glugg i ett
 * engelskt gränssnitt.
 *
 * Texter med värden i sig är funktioner, så att ordföljden kan skilja sig
 * mellan språken. Plural likaså: engelskan säger «1 song, 2 songs», svenskan
 * «1 låt, 2 låtar», och båda får forma sin egen mening.
 *
 * Tonnamn, solmisation och tonplatser översätts inte härifrån. De är
 * musikaliska inställningar med egna val i appen — en svensk körledare kan
 * mycket väl vilja ha internationella tonnamn, och tvärtom.
 */
import type { MetronomeVisualStyle, StartTab } from '../state/settings.ts';
import type { SubdivisionId } from '../audio/subdivisions.ts';
import type { TimbreId } from '../audio/timbres.ts';
import type { ThemeId } from '../theme.ts';

export const sv = {
  skal: {
    låsUpp: 'Dra låset åt höger för att låsa upp',
  },

  spel: {
    starta: 'Starta',
    stoppa: 'Stoppa',
    knacka: 'Knacka',
    slagPerTakt: 'Slag per takt',
    underdelning: 'Underdelning',
    tongivning: 'Tongivning',
    ackord: 'Ackord',
    iValdOrdning: '⇢ I vald ordning',
    spelaTon: (ton: string) => `Spela ${ton}`,
    klaviatur: 'Klaviatur',
    väljToner: 'Välj toner för tongivning',
    renStämning: 'Ren stämning',
    oktavNed: '◀ Oktav',
    oktavUpp: 'Oktav ▶',
    tryckFörTon: 'Tryck på en tangent på klaviaturen för att lägga till en ton.',
    spara: 'Spara',
    nyLåt: 'Ny låt',
    namnPåLåten: 'Namn på låten',
    uppdatera: 'Uppdatera',
    sparaSomNy: 'Spara som ny',
    skapaNyLåt: 'Skapa ny låt',
    kopiaAv: (titel: string) => `${titel} (kopia)`,
    sparasMed:
      'Låten sparas med tempot, taktarten, stämningen och tonerna som är inställda ovan.',
  },

  lista: {
    sök: 'Sök bland låtarna',
    ingenTräff: (sökning: string) => `Ingen låt matchar «${sökning}».`,
    träffar: (antal: number, sökning: string) =>
      `${antal} ${antal === 1 ? 'träff' : 'träffar'} på «${sökning}».`,
    antalLåtar: (antal: number) => `${antal} ${antal === 1 ? 'låt' : 'låtar'}`,
    utanförMappar: (antal: number) => `Utanför mappar (${antal})`,
    sparadeLåtar: (antal: number) => `Sparade låtar (${antal})`,
    tempo: '▶ Tempo',
    ingaToner: '♪ Inga toner',
    ingaSparadeToner: 'Inga sparade toner',
    ingaTonerAttSpela: 'Inga sparade toner att spela. Lägg till toner via «Ändra».',
    toner: 'Toner:',
    tempererad: 'tempererad',
    renGrundton: (ton: string) => `ren, grundton ${ton}`,
    slagPerMinut: 'slag/min',
    tomMapp: 'Mappen är tom. Dra hit en låt i dess grepp.',
    allaLåtarIMappar: 'Alla låtar ligger i mappar. Dra en hit för att ta ut den.',
    ingaLåtarÄn:
      'Inga låtar sparade än. Ställ in tempo och toner i spelvyn och lägg till låten här.',
    nyMapp: 'Ny mapp',
    namnPåMappen: 'Namn på mappen',
    skapa: 'Skapa',
    klart: 'Klart',
    taBortLåt: (titel: string) => `Ta bort «${titel}»?`,
    låtenFörsvinner: 'Låten försvinner ur biblioteket.',
    taBort: 'Ta bort',
    avbryt: 'Avbryt',
    taBortMapp: (namn: string) => `Ta bort mappen «${namn}»?`,
    mappenInnehåller: (antal: number) =>
      antal === 1 ? 'Mappen innehåller en låt.' : `Mappen innehåller ${antal} låtar.`,
    läggUtanför: 'Lägg låtarna utanför mappen',
    taBortAlla: 'Ta bort alla låtar i mappen',
    konsertläge: 'Konsertläge',
    konsertlägeText:
      'Låser appen till uppspelning: inga låtar eller inställningar går att ändra, och bara listan visas. Bra när telefonen ligger framme på notstället.',
    draFörAttLåsa: 'Dra låset åt höger för att låsa',
    låstText:
      'Appen är låst i konsertläge: bara uppspelning är möjlig. Lås upp genom att dra låset längst ner åt höger.',
  },

  inst: {
    volym: 'Volym',
    ljudstyrka: 'Ljudstyrka',
    testaLjudet: 'Testa ljudet',
    kammarton: 'Kammarton',
    kammartonText:
      'Standard är 440 Hz. Många orglar och blåsorkestrar ligger på 442 Hz, och barockensembler ofta på 415 Hz.',
    återställ440: 'Återställ till 440 Hz',
    färgtema: 'Färgtema',
    metronom: 'Metronom',
    betonaEttan: 'Betona ettan',
    betonaEttanText:
      'Taktens första slag klingar ljusare än de andra. Avstängt låter alla slag lika — bra när takten inte ska höras, bara pulsen.',
    hållSkärmenTänd: 'Håll skärmen tänd',
    hållSkärmenTändText:
      'Skärmen slocknar inte medan metronomen går. Telefonen ligger framme på notstället och ska inte somna mitt i en sats.',
    känsel: 'Känsel',
    vibration: 'Vibration',
    vibrationText:
      'Telefonen svarar med en liten stöt när tempohjulet vrids, ett kort lyfts eller låset slår till. Gäller inte i webbläsaren.',
    redigeringsvyn: 'Redigeringsvyn',
    tongivningFörst: 'Tongivning först',
    tongivningFörstText:
      'Lägger klaviaturen och tongivningens knappar överst, med metronomen under. Avstängt börjar vyn med metronomen, som förut.',
    startvy: 'Startvy',
    startvyVal: {
      auto: 'Automatisk',
      play: '+',
      songs: 'Låtlistan',
    } satisfies Record<StartTab, string>,
    startvyText: 'Automatisk öppnar låtlistan när det finns sparade låtar, annars skapandet.',
    tempoFrånListan: 'Tempo från låtlistan',
    stoppaSjälv: 'Stoppa av sig själv',
    efter: 'Efter',
    antalSlag: (antal: number) => `${antal} slag`,
    autoStopText: (slag: string) =>
      `Tempoknappen i låtlistan stoppar metronomen av sig själv efter ${slag} slag — varje hörbart klick räknas, underdelningar med. Gäller bara starter från listan — i spelvyn går metronomen tills du stoppar den.`,
    ettAntal: 'ett antal',
    tonnamn: 'Tonnamn på tangenterna',
    visas: 'Visas',
    dolda: 'Dolda',
    bokstäver: 'Bokstäver',
    doReMi: 'Do re mi',
    tonplatser: 'Tonplatser',
    bokstavssystem: 'Bokstavssystem',
    internationellText:
      'Internationell notation: tonen över A heter B, och tonen ett halvt steg under heter B♭.',
    svenskText:
      'Svensk notation: tonen över A heter H, och tonen ett halvt steg under heter B.',
    räknasFrån: 'Räknas från',
    grundtonen: 'Grundtonen',
    flyttbartText: (namn: string) =>
      `Flyttbart: grundtonen blir alltid ${namn}, så samma benämning betyder samma funktion oavsett tonart. Grundtonen väljs med dubbeltryck på klaviaturen.`,
    fastText: (namn: string) => `Fast: C är alltid ${namn}, oavsett vilken tonart stycket går i.`,
    solfegeFotnot:
      'Halvtonerna stavas sänkta — ra, me, le, te — utom den höjda kvarten fi. En kör möter till exempel F i G-dur som sänkt septim, inte som höjd sext.',
    markeraGrundton: 'Markera grundtonstangenten',
    baraIRen: 'Bara i ren stämning',
    alltid: 'Alltid',
    grundtonAlltidText: 'Grundtonen märks ut med etikett och färg i båda stämningarna.',
    grundtonRenText:
      'Grundtonen märks bara ut i ren stämning, där allt annat stäms mot den. I tempererad stämning har den ingen hörbar följd.',
    avanceradeUnderdelningar: 'Avancerade underdelningar',
    avanceradeText:
      'Lägger till swing, punkterat och kvintol bland underdelningarna i spelvyn. Till skillnad från de vanliga är de ojämnt fördelade över taktslaget.',
    taktvisare: 'Taktvisare',
    taktvisareVal: {
      pendulum: 'Pendel',
      bar: 'Streck',
      ball: 'Boll',
      none: 'Ingen',
    } satisfies Record<MetronomeVisualStyle, string>,
    taktvisareText: {
      pendulum: 'En klassisk pendel som vänder på varje taktslag.',
      bar: 'Ett streck som går fram och tillbaka och vänder på varje taktslag.',
      ball: 'En boll som studsar mot marken på varje taktslag. Studsen blir högre vid långsamma tempon och lägre vid snabba.',
      none: 'Ingen grafisk taktvisare. Taktdelarna syns ändå som prickar i tempohjulet.',
    } satisfies Record<MetronomeVisualStyle, string>,
    klangfärg: 'Klangfärg',
    tryckFörAttHöra: 'Tryck på en klang för att höra den.',
    tempoPåTongivning: 'Tempo på tongivning',
    slagPerMin: (antal: number) => `${antal} slag/min`,
    tongivningText:
      'Tempot mellan tonerna när de ges en i taget. Gäller alla låtar. Knappen ovanför spelar spelvyns toner, eller ett C-durackord uppifrån och ner om inga är valda.',
    tonordningFotnot:
      'Tonerna sparas alltid i den ordning du väljer dem. Knapparna i spelvyn avgör om de ges nedifrån och upp, uppifrån och ner, eller i den valda ordningen.',
    renaIntervall: 'Rena intervall',
    renaIntervallText:
      'I ren stämning byggs varje intervall av en enkel frekvenskvot, vilket gör att övertonerna sammanfaller och svävningarna försvinner. Så här mycket skiljer sig tonerna från ett piano:',
    centFotnot: 'Avvikelse i cent, där 100 cent är en halvton på pianot.',
    säkerhetskopia: 'Säkerhetskopia',
    säkerhetskopiaText:
      'Sparar hela biblioteket — låtar, mappar, tempon och toner — som en fil du kan lägga i iCloud Drive, mejla eller flytta till en annan telefon.',
    sparaKopia: 'Spara en kopia',
    läsInKopia: 'Läs in en kopia',
    inläst: (tillagda: number, uppdaterade: number) =>
      tillagda === 0 && uppdaterade === 0
        ? 'Kopian är inläst. Biblioteket hade redan allt den innehöll.'
        : `Kopian är inläst: ${tillagda} ${tillagda === 1 ? 'låt' : 'låtar'} lades till och ${uppdaterade} ${uppdaterade === 1 ? 'byttes' : 'byttes'} mot en nyare version.`,
    inteEnKopia:
      'Filen gick inte att läsa som en bibliotekskopia. Ingenting har ändrats.',
    inläsningAldrigRaderar:
      'Inläsning lägger till och uppdaterar, men tar aldrig bort något.',
    tack: 'Tack',
    tackText:
      'Flygeln är Salamander Grand Piano V3 — en Yamaha C5 inspelad av Alexander Holm, använd under licensen CC BY 3.0.',
    tackFotnot:
      'Proven är bearbetade: ett urval av tonerna, transponerade till tonhöjderna däremellan, med kortad utklingning och justerad nivå.',
  },

  volym: {
    avstängt: 'Telefonens ljud är avstängt',
    nästanAvstängt: 'Telefonens volym är nästan avstängd',
    höjMedKnapparna:
      'Höj med knapparna på telefonens sida. Appens egen volym i inställningarna ligger ovanpå den här nivån.',
  },

  /** Intervallnamnen i den rena stämningens tabell, i halvtonsordning från prim. */
  intervall: [
    'Prim',
    'Liten sekund',
    'Stor sekund',
    'Liten ters',
    'Stor ters',
    'Kvart',
    'Tritonus',
    'Kvint',
    'Liten sext',
    'Stor sext',
    'Liten septim',
    'Stor septim',
  ] as readonly string[],

  klang: {
    salamander: {
      namn: 'Flygel',
      text: 'Inspelad Yamaha C5 — Salamander Grand Piano av Alexander Holm, CC-BY 3.0. Hela utklingningen som den spelades in.',
    },
    choir: {
      namn: 'Körton',
      text: 'Jämn, orgelaktig ton som ligger kvar så länge du håller den.',
    },
    tuningFork: {
      namn: 'Stämgaffel',
      text: 'Nästan ren ton, lugn och lätt att sjunga mot.',
    },
    flute: {
      namn: 'Flöjt',
      text: 'Mjuk och rund, med långsamt anslag.',
    },
    sine: {
      namn: 'Sinus',
      text: 'Ren sinuston utan övertoner. Mjukast tänkbara klang — men skillnaden mellan tempererad och ren stämning hörs inte.',
    },
  } satisfies Record<TimbreId, { namn: string; text: string }>,

  underdelning: {
    quarter: { namn: 'Fjärdedelar', text: 'Ett klick per taktslag.' },
    eighth: { namn: 'Åttondelar', text: 'Två jämna klick per taktslag.' },
    triplet: { namn: 'Trioler', text: 'Tre jämna klick per taktslag.' },
    sixteenth: { namn: 'Sextondelar', text: 'Fyra jämna klick per taktslag.' },
    swing8: {
      namn: 'Swing 8',
      text: 'Åttondelsswing. Andra klicket ligger på trioldelningens sista tredjedel — lång, kort.',
    },
    dotted8: {
      namn: 'Punkterat',
      text: 'Punkterad åttondel och sextondel. Hårdare gungning än swing, eftersom andra klicket kommer senare.',
    },
    swing16: {
      namn: 'Swing 16',
      text: 'Sextondelsswing. Varje åttondelspar gungar för sig, alltså fyra klick där andra och fjärde ligger sent.',
    },
    quintuplet: { namn: 'Kvintol', text: 'Fem jämna klick per taktslag.' },
  } satisfies Record<SubdivisionId, { namn: string; text: string }>,

  tema: {
    konsertsal: {
      namn: 'Konsertsal',
      text: 'Mörkt och lågmält, avläsbart på en armlängds avstånd i dunkel sal.',
    },
    katedral: {
      namn: 'Katedral',
      text: 'Djupblått och guld, som kvällsljus genom ett glasfönster.',
    },
    sammet: {
      namn: 'Sammet',
      text: 'Vinrött och gammelguld, som ridån i en operasalong.',
    },
    nocturne: {
      namn: 'Nocturne',
      text: 'Svalt blågrått med silverblå ton. Vilsamt för ögat sent på kvällen.',
    },
    notblad: {
      namn: 'Notblad',
      text: 'Ljust notpapper med bläckrött. Ljust nog för repetition i dagsljus.',
    },
    flygel: {
      namn: 'Flygel',
      text: 'Svart och vitt med mässing, som ett flygellock och dess beslag.',
    },
    pergament: {
      namn: 'Pergament',
      text: 'Varm sepia med hög kontrast. Läsbar även i starkt solljus.',
    },
  } satisfies Record<ThemeId, { namn: string; text: string }>,
};

export type Texter = typeof sv;
