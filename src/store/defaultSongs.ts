/**
 * Biblioteket som följer med en nyinstallerad app.
 *
 * En mapp med fyra välkända körstycken, så att listan har något att visa
 * innan man hunnit lägga in sitt eget: man kan höra tongivningen, känna
 * tempot och se hur mappar och sparade låtar ser ut, utan att först behöva
 * mata in något.
 *
 * De läggs in en enda gång, när lagringen är orörd. Tar man bort dem kommer
 * de inte tillbaka — ett tomt bibliotek är ett medvetet val och ska respekteras.
 */
// Ändelsen behövs för att Node ska hitta filen när testerna körs med
// typavskalning, och type-nyckelordet hindrar en import i körläge.
import type { Folder, Song } from './songs.ts';

/** Mappen låtarna ligger i. Id:t är fast, så att låtarna hittar hem. */
const SOMMAR = 'standard-svensk-sommar';

export const DEFAULT_FOLDERS: Folder[] = [
  { id: SOMMAR, name: 'Svensk sommar', createdAt: 0 },
];

/**
 * Fälten skrivs ut i klartext i stället för att byggas med createSong, så att
 * innehållet går att läsa och rätta här. Tonerna är MIDI-nummer där 60 är C4,
 * och står i den ordning de ska ges. sortIndex ger mappens egen följd.
 */
export const DEFAULT_SONGS: Song[] = [
  {
    id: 'standard-uti-var-hage',
    sortIndex: 1,
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
    folderId: SOMMAR,
  },
  {
    id: 'standard-aftonen',
    sortIndex: 2,
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
    folderId: SOMMAR,
  },
  {
    id: 'standard-kung-liljekonvalje',
    sortIndex: 3,
    title: 'Kung Liljekonvalje',
    bpm: 52,
    beatsPerBar: 4,
    subdivision: 'quarter',
    tuningSystem: 'tempered',
    tonicPitchClass: 7,
    tones: [55],
    notes: '',
    updatedAt: 0,
    folderId: SOMMAR,
  },
  {
    id: 'standard-sommarpsalm',
    sortIndex: 4,
    title: 'Sommarpsalm – En vänlig grönskas rika dräkt',
    bpm: 114,
    beatsPerBar: 4,
    subdivision: 'quarter',
    tuningSystem: 'just',
    // G som grundton, men tonerna som ges är D — en ren kvint under. Att ge
    // kören en annan ton än grundtonen är vanligt.
    tonicPitchClass: 7,
    tones: [50, 62],
    notes: '',
    updatedAt: 0,
    folderId: SOMMAR,
  },
];
