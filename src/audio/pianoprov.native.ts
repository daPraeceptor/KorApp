/**
 * Var proven finns på iOS och Android.
 *
 * Här buntas hela klaviaturen in i appen — trettio prov, fem megabyte. I en
 * app som ändå väger tiotals megabyte är det ingenting, och då finns hela
 * flygeln på plats även utan nät. Webbens motsvarighet i pianoprov.ts bär
 * bara körregistret, eftersom den måste laddas ner varje gång.
 *
 * Metro kräver att varje require står utskrivet: modulnamn som räknas fram
 * går inte att bunta. Därför den här listan, och därför är filerna döpta
 * efter sitt MIDI-nummer.
 *
 * Filen är framställd av verktyg/skriv-pianoprov.mjs.
 */

export interface Prov {
  midi: number;
  /** Modulnumret från require. Ljudmotorn avkodar det direkt. */
  modul: number;
}

export const PROV: Prov[] = [
  { midi: 21, modul: require('../../assets/piano/21.ogg') }, // A0
  { midi: 24, modul: require('../../assets/piano/24.ogg') }, // C1
  { midi: 27, modul: require('../../assets/piano/27.ogg') }, // D♯1
  { midi: 30, modul: require('../../assets/piano/30.ogg') }, // F♯1
  { midi: 33, modul: require('../../assets/piano/33.ogg') }, // A1
  { midi: 36, modul: require('../../assets/piano/36.ogg') }, // C2
  { midi: 39, modul: require('../../assets/piano/39.ogg') }, // D♯2
  { midi: 42, modul: require('../../assets/piano/42.ogg') }, // F♯2
  { midi: 45, modul: require('../../assets/piano/45.ogg') }, // A2
  { midi: 48, modul: require('../../assets/piano/48.ogg') }, // C3
  { midi: 51, modul: require('../../assets/piano/51.ogg') }, // D♯3
  { midi: 54, modul: require('../../assets/piano/54.ogg') }, // F♯3
  { midi: 57, modul: require('../../assets/piano/57.ogg') }, // A3
  { midi: 60, modul: require('../../assets/piano/60.ogg') }, // C4
  { midi: 63, modul: require('../../assets/piano/63.ogg') }, // D♯4
  { midi: 66, modul: require('../../assets/piano/66.ogg') }, // F♯4
  { midi: 69, modul: require('../../assets/piano/69.ogg') }, // A4
  { midi: 72, modul: require('../../assets/piano/72.ogg') }, // C5
  { midi: 75, modul: require('../../assets/piano/75.ogg') }, // D♯5
  { midi: 78, modul: require('../../assets/piano/78.ogg') }, // F♯5
  { midi: 81, modul: require('../../assets/piano/81.ogg') }, // A5
  { midi: 84, modul: require('../../assets/piano/84.ogg') }, // C6
  { midi: 87, modul: require('../../assets/piano/87.ogg') }, // D♯6
  { midi: 90, modul: require('../../assets/piano/90.ogg') }, // F♯6
  { midi: 93, modul: require('../../assets/piano/93.ogg') }, // A6
  { midi: 96, modul: require('../../assets/piano/96.ogg') }, // C7
  { midi: 99, modul: require('../../assets/piano/99.ogg') }, // D♯7
  { midi: 102, modul: require('../../assets/piano/102.ogg') }, // F♯7
  { midi: 105, modul: require('../../assets/piano/105.ogg') }, // A7
  { midi: 108, modul: require('../../assets/piano/108.ogg') }, // C8
];
