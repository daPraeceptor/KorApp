/**
 * Låtarna som följer med en nyinstallerad app.
 *
 * Fyra välkända körstycken, så att listan har något att visa innan man hunnit
 * lägga in sitt eget: man kan höra tongivningen, känna tempot och se hur en
 * sparad låt ser ut, utan att först behöva mata in en.
 *
 * De läggs in en enda gång, när lagringen är orörd. Tar man bort dem kommer
 * de inte tillbaka — ett tomt bibliotek är ett medvetet val och ska respekteras.
 */
// Ändelsen behövs för att Node ska hitta filen när testerna körs med
// typavskalning, och type-nyckelordet hindrar en import i körläge.
import type { Song } from './songs.ts';

/**
 * Fälten skrivs ut i klartext i stället för att byggas med createSong, så att
 * innehållet går att läsa och rätta här. Tonerna är MIDI-nummer där 60 är C4,
 * och står i den ordning de ska ges.
 */
export const DEFAULT_SONGS: Song[] = [
  {
    id: 'standard-aftonen',
    sortIndex: 1,
    title: 'Aftonen',
    bpm: 62,
    beatsPerBar: 4,
    subdivision: 'quarter',
    tuningSystem: 'just',
    // F som grundton: A4 och F4 bildar en ren ters över grundtonen.
    tonicPitchClass: 5,
    tones: [69, 65],
    notes: '',
    updatedAt: 0,
    folderId: null,
  },
  {
    id: 'standard-kung-liljekonvalje',
    sortIndex: 2,
    title: 'Kung Liljekonvalje',
    bpm: 52,
    beatsPerBar: 4,
    subdivision: 'quarter',
    tuningSystem: 'tempered',
    tonicPitchClass: 7,
    tones: [55],
    notes: '',
    updatedAt: 0,
    folderId: null,
  },
  {
    id: 'standard-sommarpsalm',
    sortIndex: 3,
    title: 'Sommarpsalm – En vänlig grönskas rika dräkt',
    bpm: 114,
    beatsPerBar: 4,
    subdivision: 'quarter',
    tuningSystem: 'just',
    tonicPitchClass: 7,
    tones: [50, 62],
    notes: '',
    updatedAt: 0,
    folderId: null,
  },
  {
    id: 'standard-uti-var-hage',
    sortIndex: 4,
    title: 'Uti vår hage',
    bpm: 118,
    beatsPerBar: 3,
    subdivision: 'quarter',
    tuningSystem: 'just',
    tonicPitchClass: 5,
    // F-mollklang uppifrån och ner: F4, C4, Ab3, F3.
    tones: [65, 60, 56, 53],
    notes: '',
    updatedAt: 0,
    folderId: null,
  },
];
