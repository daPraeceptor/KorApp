/**
 * Tre försök att få fram ett piano.
 *
 * Ett piano är svårt av tre skäl på en gång. Strängen är styv, så dess
 * deltoner ligger inte på jämna multiplar utan sträcks isär uppåt. Varje ton
 * har två eller tre strängar som stäms nästan lika, och den lilla skillnaden
 * ger tonen sitt liv. Och klangen förändras hela tiden: det ljusa i anslaget
 * är borta efter en halv sekund medan grundtonen ligger kvar i flera.
 *
 * De tre modellerna angriper det från var sitt håll:
 *
 *  1. STRÄNGAR — additiv syntes med många deltoner, var och en på sin sträckta
 *     frekvens och med sin egen utklingning, och de lägsta dubblerade som en
 *     körsträngsgrupp. Mest trogen i deltonernas läge, dyrast i antal
 *     oscillatorer.
 *  2. FM — två modulatorer på en bärvåg, med moduleringsdjup som faller
 *     snabbt. Så gjorde DX7:an sitt piano 1983, och det är fortfarande det
 *     billigaste sättet att få ett anslag som klarnar av. Fyra oscillatorer
 *     räcker för hela tonen.
 *  3. MODELL — en fysikalisk strängmodell (Karplus–Strong) som räknas fram
 *     till en ljudbuffert första gången tonen behövs, och sedan spelas som ett
 *     ljudprov. Här är det inte deltonerna som beskrivs utan själva strängen:
 *     ett hammarslag skickas in i en slinga som dämpar det ljusa fortare än
 *     det mörka, precis som en verklig sträng gör.
 *
 * Om ljudprov: modellen visar vägen. Inspelade flygelprov skulle låta bäst av
 * allt, men de måste komma från en licensierad uppsättning och väger tiotals
 * megabyte — appen är i dag på några hundra kilobyte. Bufferten här räknas
 * fram i appen och kostar ingenting att distribuera.
 */
import type { PartialSpec } from './timbres.ts';

/**
 * Hur länge tonen klingar. Basen ligger kvar länge, diskanten dör fort — en
 * verklig flygel går från en halv minut i basen till ungefär en sekund högst
 * upp.
 */
export function strängTid(f0: number): number {
  return Math.min(20, Math.max(0.7, 9 * Math.pow(261.63 / f0, 0.8)));
}

/**
 * Styvhetstalet B, som sträcker deltonerna uppåt: delton n ligger inte på
 * n·f0 utan på n·f0·√(1+B·n²). Korta tjocka strängar är styvast, därför växer
 * talet uppåt i klaviaturen. Det är den här sträckningen som gör att ett
 * piano stäms med sträckt stämning, och att en oktav på ett piano är något
 * större än 2:1.
 */
export function styvhet(f0: number): number {
  return Math.min(0.006, Math.max(0.00008, 0.00025 * Math.pow(f0 / 261.63, 1.4)));
}

/** Hammaren träffar strängen ungefär en åttondel in. */
const HAMMARLÄGE = 1 / 8;

/** Så många deltoner byggs som mest. Ljudmotorn sållar bort de ohörbara. */
const DELTONER = 16;

/** De lägsta deltonerna får en andra sträng, snäppet bredvid i stämning. */
const KÖRSTRÄNGAR = 6;
/** Skillnaden mellan strängarna i en tongrupp, i cent. */
const KÖRSPRIDNING = 0.7;

/**
 * Deltonerna för en struken pianoton.
 *
 * Två drag är värda att peka ut. Deltoner som är multiplar av åtta saknas
 * nästan helt: hammaren träffar i en punkt där just de har sin nod och därför
 * inte kan sättas i rörelse. Och varje delton har sin egen utklingningstid —
 * ju ljusare desto kortare — vilket är hela skillnaden mellan ett anslag som
 * klarnar av och en orgelton som bara tystnar.
 */
export function strängPartialer(f0: number): PartialSpec[] {
  const B = styvhet(f0);
  const grundtid = strängTid(f0);
  const ut: PartialSpec[] = [];

  for (let n = 1; n <= DELTONER; n += 1) {
    // Hammarens läge tystar deltoner som har en nod just där.
    const hammare = Math.abs(Math.sin(Math.PI * n * HAMMARLÄGE));
    const styrka = (hammare / Math.pow(n, 1.25)) * (n === 1 ? 1 : 0.85);
    if (styrka < 0.004) {
      continue;
    }
    const sträckt = n * Math.sqrt(1 + B * n * n);
    // Ljusa deltoner dör fortare. Utklingningen anges här som hel tid i
    // sekunder, därför står klangens partialDecay på ett.
    const tid = Math.max(0.12, grundtid / Math.pow(n, 0.62));

    if (n <= KÖRSTRÄNGAR) {
      // Tongruppens strängar stäms nästan lika. Skillnaden hörs inte som
      // orenhet utan som att tonen lever: de går isär och möts om vartannat,
      // och tillsammans klingar de av i två steg — först snabbt, sedan långt.
      const spridning = Math.pow(2, KÖRSPRIDNING / 1200);
      ut.push({ ratio: sträckt / spridning, gain: styrka * 0.55, decayScale: tid });
      ut.push({ ratio: sträckt * spridning, gain: styrka * 0.55, decayScale: tid * 0.82 });
    } else {
      ut.push({ ratio: sträckt, gain: styrka, decayScale: tid });
    }
  }

  return ut;
}

// ---------- FM ----------

export interface FMRecept {
  /** Bärvågens frekvens. */
  bärvåg: number;
  /** Modulator som ger tonens kropp, med djup i hertz. */
  kropp: { frekvens: number; djup: number; tid: number };
  /**
   * Modulator som ger anslagets metalliska knäpp. Saknas i diskanten, där
   * den skulle hamna ovanför hörselområdet och bara vika ner sig som brus.
   */
  anslag: { frekvens: number; djup: number; tid: number } | null;
  /** Tonens egen utklingning. */
  tid: number;
}

/**
 * Ett FM-piano i DX7:ans anda: bärvågen är en ren sinuston, och all klang
 * kommer av att dess frekvens rubbas några tusendelar av en annan sinuston.
 * Djupet faller snabbt, och det är det som hörs som ett anslag: ljust i
 * ögonblicket, mjukt en halv sekund senare.
 */
export function fmRecept(f0: number): FMRecept {
  const ANSLAGSKVOT = 7;
  return {
    bärvåg: f0,
    // Modulator på samma frekvens som bärvågen ger deltoner på alla
    // multiplar — en fyllig, sträng-lik klang.
    kropp: { frekvens: f0, djup: f0 * 2.6, tid: 0.32 },
    anslag:
      f0 * ANSLAGSKVOT < 11000
        ? { frekvens: f0 * ANSLAGSKVOT, djup: f0 * 0.5, tid: 0.05 }
        : null,
    tid: Math.max(0.6, strängTid(f0) * 0.55),
  };
}

// ---------- Fysikalisk modell ----------

/**
 * Räknar fram en pianoton som ljuddata, sträng för sträng.
 *
 * Karplus–Strong i sin klassiska form: en fördröjningslinje lika lång som
 * tonens period, fylld med ett hammarslag, och en slinga där varje varv
 * dämpar de ljusa deltonerna mer än de mörka. Det är samma sak som händer i
 * en verklig sträng, och därför kommer utklingningen ut rätt av sig själv i
 * stället för att behöva beskrivas delton för delton.
 *
 * Två strängar räknas fram med en aning olika stämning och läggs ihop, av
 * samma skäl som i den additiva modellen.
 */
export function renderaSträng(
  f0: number,
  sampleRate: number,
  sekunder = Math.min(5, Math.max(1.2, strängTid(f0) * 0.7)),
): Float32Array {
  const längd = Math.max(1, Math.floor(sekunder * sampleRate));
  const ut = new Float32Array(längd);
  const spridning = Math.pow(2, KÖRSPRIDNING / 1200);

  for (const [index, frekvens] of [f0 / spridning, f0 * spridning].entries()) {
    enSträng(ut, frekvens, sampleRate, index);
  }

  // Normera till full utstyrning; nivån sätts sedan av ljudmotorn.
  let topp = 0;
  for (const v of ut) {
    topp = Math.max(topp, Math.abs(v));
  }
  if (topp > 0) {
    for (let i = 0; i < ut.length; i += 1) {
      ut[i] /= topp;
    }
  }
  return ut;
}

function enSträng(
  ut: Float32Array,
  f0: number,
  sampleRate: number,
  frö: number,
): void {
  // Slingans lågpassfilter fördröjer ett halvt sampel. Utan avdraget skulle
  // tonen ligga någon cent för lågt, vilket är precis vad appen inte får.
  const fördröjning = Math.max(2, sampleRate / f0 - 0.5);
  const heltal = Math.floor(fördröjning);
  const bråk = fördröjning - heltal;
  const linje = new Float32Array(heltal + 1);

  // Hammaren: ett kort brusknäpp. En basthammare är stor och mjuk och kan
  // inte sätta fart på de ljusaste deltonerna alls; en diskanthammare är
  // liten och hård. Därför lågpassas knäppet hårdare ju lägre tonen är.
  const mjukhet = Math.min(0.92, Math.max(0.25, 0.75 - Math.log2(f0 / 261.63) * 0.12));
  let slumptal = 1234567 + frö * 7919;
  const slump = () => {
    // Egen generator, så att samma ton alltid låter likadant.
    slumptal = (slumptal * 1103515245 + 12345) & 0x7fffffff;
    return (slumptal / 0x7fffffff) * 2 - 1;
  };
  let mjukt = 0;
  let summa = 0;
  for (let i = 0; i < linje.length; i += 1) {
    mjukt = mjukhet * mjukt + (1 - mjukhet) * slump();
    // Anslaget dör bort över linjens längd i stället för att sluta tvärt.
    linje[i] = mjukt * (1 - i / linje.length);
    summa += linje[i];
  }
  // Slingans lågpass släpper igenom likspänning orörd, så ett anslag som inte
  // summerar till noll blir en gnutta likspänning som ligger kvar hela tonen
  // igenom. Den hörs inte, men den äter utstyrning och kan knäppa till när
  // tonen börjar och slutar. Därför dras medelvärdet bort här, vid källan.
  const medel = summa / linje.length;
  for (let i = 0; i < linje.length; i += 1) {
    linje[i] -= medel;
  }

  // Dämpningen per varv sätts av hur länge tonen ska klinga.
  const tid = strängTid(f0);
  const dämpning = Math.exp(-1 / (tid * sampleRate));

  let plats = 0;
  let förra = 0;
  for (let n = 0; n < ut.length; n += 1) {
    const nästa = (plats + 1) % linje.length;
    /**
     * Bråkdelen av fördröjningen tas med linjär interpolation, annars går
     * tonhöjden bara att träffa i hela sampel.
     *
     * Vikterna hör ihop med hur gamla de två avlästa värdena är, inte med
     * ordningen i minnet: `linje[plats]` skrevs ett varv tidigare än
     * `linje[nästa]` och står alltså för den längre fördröjningen. Kastas
     * vikterna om blir periodlängden upp till ett helt sampel fel — knappt
     * hörbart i basen, men tio cent uppe i diskanten.
     */
    const avläst = (1 - bråk) * linje[nästa] + bråk * linje[plats];
    // Lågpasset i slingan: medelvärdet av två grannar. Det är det som gör
    // att det ljusa dör först.
    const värde = dämpning * 0.5 * (avläst + förra);
    förra = avläst;
    linje[plats] = värde;
    plats = nästa;
    ut[n] += värde * 0.5;
  }
}
