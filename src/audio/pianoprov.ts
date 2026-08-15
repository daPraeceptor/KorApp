/**
 * Var proven finns på webben.
 *
 * Här bärs bara körregistret, C2 till C6: sjutton prov i stället för trettio,
 * tre megabyte i stället för fem. Skillnaden mot mobilappen är avsiktlig.
 * Appen buntar in hela klaviaturen en gång för alla, medan webbsidan måste
 * hämta hem sina prov varje gång någon öppnar den — och en kör får aldrig sin
 * ton under C2, det är orgelpedal snarare än människoröst.
 *
 * Tangenter utanför registret tystnar inte. Närmaste prov spelas i stället
 * fortare eller långsammare, vilket hörs desto tydligare ju längre bort man
 * kommer: ett C8 hämtas från C6 och går i fyrdubbel hastighet.
 *
 * Proven kopieras hit av verktyg/kopiera-webbprov.mjs, som körs före
 * webbygget. Katalogen är därför inte incheckad — originalen ligger i
 * assets/piano.
 */

export interface Prov {
  midi: number;
  /** Adress att hämta provet från. Ligger under public/ i bygget. */
  url: string;
}

/** Körregistret, ett prov var liten ters. */
export const WEBBREGISTER = { lägsta: 36, högsta: 84 };

const alla = [
  21,
  ...[1, 2, 3, 4, 5, 6, 7].flatMap((oktav) =>
    [0, 3, 6, 9].map((steg) => steg + (oktav + 1) * 12),
  ),
  108,
];

export const PROV: Prov[] = alla
  .filter((midi) => midi >= WEBBREGISTER.lägsta && midi <= WEBBREGISTER.högsta)
  .map((midi) => ({ midi, url: `/piano/${midi}.ogg` }));
