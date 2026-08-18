/**
 * The app's texts in English.
 *
 * Typed against the Swedish master dictionary: a missing key here is a
 * compile error, not a Swedish gap in an English interface.
 *
 * Tone names, solfège and scale degrees are not translated here — they are
 * musical settings with their own choices in the app.
 */
import type { Texter } from './texter.sv.ts';

export const en: Texter = {
  skal: {
    låsUpp: 'Slide the lock to the right to unlock',
  },

  spel: {
    starta: 'Start',
    stoppa: 'Stop',
    knacka: 'Tap',
    slagPerTakt: 'Beats per bar',
    underdelning: 'Subdivision',
    tongivning: 'Pitch giving',
    ackord: 'Chord',
    iValdOrdning: '⇢ In chosen order',
    spelaTon: (ton) => `Play ${ton}`,
    klaviatur: 'Keyboard',
    väljToner: 'Select notes for pitch giving',
    renStämning: 'Just intonation',
    oktavNed: '◀ Octave',
    oktavUpp: 'Octave ▶',
    tryckFörTon: 'Press a key on the keyboard to add a note.',
    spara: 'Save',
    nyLåt: 'New song',
    namnPåLåten: 'Name of the song',
    uppdatera: 'Update',
    sparaSomNy: 'Save as new',
    skapaNyLåt: 'Create new song',
    kopiaAv: (titel) => `${titel} (copy)`,
    sparasMed:
      'The song is saved with the tempo, time signature, tuning and notes set above.',
  },

  lista: {
    sök: 'Search the songs',
    ingenTräff: (sökning) => `No song matches “${sökning}”.`,
    träffar: (antal, sökning) =>
      `${antal} ${antal === 1 ? 'match' : 'matches'} for “${sökning}”.`,
    antalLåtar: (antal) => `${antal} ${antal === 1 ? 'song' : 'songs'}`,
    utanförMappar: (antal) => `Outside folders (${antal})`,
    sparadeLåtar: (antal) => `Saved songs (${antal})`,
    tempo: '▶ Tempo',
    ingaToner: '♪ No notes',
    ingaSparadeToner: 'No saved notes',
    ingaTonerAttSpela: 'No saved notes to play. Add notes via “Edit”.',
    toner: 'Notes:',
    tempererad: 'equal temperament',
    renGrundton: (ton) => `just, tonic ${ton}`,
    slagPerMinut: 'bpm',
    tomMapp: 'The folder is empty. Drag a song here by its grip.',
    allaLåtarIMappar: 'All songs are in folders. Drag one here to take it out.',
    ingaLåtarÄn:
      'No songs saved yet. Set tempo and notes in the play view and add the song here.',
    nyMapp: 'New folder',
    namnPåMappen: 'Name of the folder',
    skapa: 'Create',
    klart: 'Done',
    taBortLåt: (titel) => `Delete “${titel}”?`,
    låtenFörsvinner: 'The song disappears from the library.',
    taBort: 'Delete',
    avbryt: 'Cancel',
    taBortMapp: (namn) => `Delete the folder “${namn}”?`,
    mappenInnehåller: (antal) =>
      antal === 1 ? 'The folder contains one song.' : `The folder contains ${antal} songs.`,
    läggUtanför: 'Move the songs outside the folder',
    taBortAlla: 'Delete all songs in the folder',
    konsertläge: 'Concert mode',
    konsertlägeText:
      'Locks the app to playback: no songs or settings can be changed, and only the list is shown. Useful when the phone sits out on the music stand.',
    draFörAttLåsa: 'Slide the lock to the right to lock',
    låstText:
      'The app is locked in concert mode: only playback is possible. Unlock by sliding the lock at the bottom right.',
  },

  inst: {
    volym: 'Volume',
    ljudstyrka: 'Loudness',
    testaLjudet: 'Test the sound',
    kammarton: 'Concert pitch',
    kammartonText:
      'Standard is 440 Hz. Many organs and wind bands sit at 442 Hz, and baroque ensembles often at 415 Hz.',
    återställ440: 'Reset to 440 Hz',
    färgtema: 'Colour theme',
    metronom: 'Metronome',
    betonaEttan: 'Accent the downbeat',
    betonaEttanText:
      'The first beat of the bar rings brighter than the rest. Off makes every beat equal — useful when only the pulse should be heard, not the metre.',
    hållSkärmenTänd: 'Keep the screen awake',
    hållSkärmenTändText:
      'The screen does not go dark while the metronome runs. The phone sits on the music stand and should not fall asleep mid-movement.',
    känsel: 'Haptics',
    vibration: 'Vibration',
    vibrationText:
      'The phone answers with a small tap when the tempo wheel turns, a card lifts or the lock engages. Does not apply in the browser.',
    redigeringsvyn: 'Editing view',
    tongivningFörst: 'Pitch giving first',
    tongivningFörstText:
      'Puts the keyboard and the pitch-giving buttons on top, with the metronome below. Off starts the view with the metronome, as before.',
    startvy: 'Start view',
    startvyVal: {
      auto: 'Automatic',
      play: '+',
      songs: 'Song list',
    },
    startvyText: 'Automatic opens the song list when there are saved songs, otherwise the editor.',
    tempoFrånListan: 'Tempo from the song list',
    stoppaSjälv: 'Stop by itself',
    efter: 'After',
    antalSlag: (antal) => `${antal} beats`,
    autoStopText: (slag) =>
      `The tempo button in the song list stops the metronome by itself after ${slag} beats — every audible click counts, subdivisions included. Only applies to starts from the list — in the play view the metronome runs until you stop it.`,
    ettAntal: 'a number of',
    tonnamn: 'Note names on the keys',
    visas: 'Shown',
    dolda: 'Hidden',
    bokstäver: 'Letters',
    doReMi: 'Do re mi',
    tonplatser: 'Degrees',
    bokstavssystem: 'Letter system',
    internationellText:
      'International notation: the note above A is called B, and the note a half step below is B♭.',
    svenskText:
      'Swedish notation: the note above A is called H, and the note a half step below is B.',
    räknasFrån: 'Counted from',
    grundtonen: 'The tonic',
    flyttbartText: (namn) =>
      `Movable: the tonic is always ${namn}, so the same name means the same function in every key. The tonic is chosen with a double tap on the keyboard.`,
    fastText: (namn) => `Fixed: C is always ${namn}, whatever key the piece is in.`,
    solfegeFotnot:
      'The semitones are spelled lowered — ra, me, le, te — except the raised fourth fi. A choir meets, say, F in G major as a lowered seventh, not a raised sixth.',
    markeraGrundton: 'Mark the tonic key',
    baraIRen: 'Only in just intonation',
    alltid: 'Always',
    grundtonAlltidText: 'The tonic is marked with label and colour in both tunings.',
    grundtonRenText:
      'The tonic is only marked in just intonation, where everything else is tuned against it. In equal temperament it has no audible consequence.',
    avanceradeUnderdelningar: 'Advanced subdivisions',
    avanceradeText:
      'Adds swing, dotted rhythm and quintuplets to the subdivisions in the play view. Unlike the ordinary ones, they are unevenly spread across the beat.',
    taktvisare: 'Beat indicator',
    taktvisareVal: {
      pendulum: 'Pendulum',
      bar: 'Bar',
      ball: 'Ball',
      none: 'None',
    },
    taktvisareText: {
      pendulum: 'A classic pendulum that turns on every beat.',
      bar: 'A bar that travels back and forth, turning on every beat.',
      ball: 'A ball that bounces off the ground on every beat. The bounce is higher at slow tempos and lower at fast ones.',
      none: 'No visual beat indicator. The beats still show as dots in the tempo wheel.',
    },
    klangfärg: 'Timbre',
    tryckFörAttHöra: 'Tap a timbre to hear it.',
    tempoPåTongivning: 'Pitch-giving tempo',
    slagPerMin: (antal) => `${antal} bpm`,
    tongivningText:
      'The tempo between the notes when they are given one at a time. Applies to all songs. The button above plays the notes in the play view, or a C major chord from the top down if none are chosen.',
    tonordningFotnot:
      'The notes are always saved in the order you choose them. The buttons in the play view decide whether they are given bottom-up, top-down, or in the chosen order.',
    renaIntervall: 'Just intervals',
    renaIntervallText:
      'In just intonation every interval is built from a simple frequency ratio, which makes the overtones coincide and the beating disappear. This is how much the notes differ from a piano:',
    centFotnot: 'Deviation in cents, where 100 cents is one semitone on the piano.',
    tack: 'Thanks',
    tackText:
      'The grand piano is Salamander Grand Piano V3 — a Yamaha C5 recorded by Alexander Holm, used under the CC BY 3.0 licence.',
    tackFotnot:
      'The samples are adapted: a selection of the notes, transposed to the pitches in between, with shortened decay and adjusted level.',
  },

  volym: {
    avstängt: 'The phone is muted',
    nästanAvstängt: 'The phone volume is nearly off',
    höjMedKnapparna:
      'Raise it with the buttons on the side of the phone. The app volume in the settings sits on top of this level.',
  },

  intervall: [
    'Unison',
    'Minor second',
    'Major second',
    'Minor third',
    'Major third',
    'Fourth',
    'Tritone',
    'Fifth',
    'Minor sixth',
    'Major sixth',
    'Minor seventh',
    'Major seventh',
  ],

  klang: {
    salamander: {
      namn: 'Grand piano',
      text: 'A recorded Yamaha C5 — Salamander Grand Piano by Alexander Holm, CC-BY 3.0. The full decay as it was recorded.',
    },
    choir: {
      namn: 'Choir tone',
      text: 'Even, organ-like tone that stays as long as you hold it.',
    },
    tuningFork: {
      namn: 'Tuning fork',
      text: 'Nearly pure tone, calm and easy to sing against.',
    },
    flute: {
      namn: 'Flute',
      text: 'Soft and round, with a slow attack.',
    },
    sine: {
      namn: 'Sine',
      text: 'A pure sine tone with no overtones. The softest possible sound — but the difference between equal temperament and just intonation cannot be heard.',
    },
  },

  underdelning: {
    quarter: { namn: 'Quarter notes', text: 'One click per beat.' },
    eighth: { namn: 'Eighth notes', text: 'Two even clicks per beat.' },
    triplet: { namn: 'Triplets', text: 'Three even clicks per beat.' },
    sixteenth: { namn: 'Sixteenth notes', text: 'Four even clicks per beat.' },
    swing8: {
      namn: 'Swing 8',
      text: 'Eighth-note swing. The second click sits on the last third of the triplet — long, short.',
    },
    dotted8: {
      namn: 'Dotted',
      text: 'Dotted eighth and sixteenth. A harder lilt than swing, since the second click comes later.',
    },
    swing16: {
      namn: 'Swing 16',
      text: 'Sixteenth-note swing. Each pair of eighths swings on its own — four clicks with the second and fourth late.',
    },
    quintuplet: { namn: 'Quintuplet', text: 'Five even clicks per beat.' },
  },

  tema: {
    konsertsal: {
      namn: 'Concert hall',
      text: 'Dark and quiet, readable at arm’s length in a dim hall.',
    },
    katedral: {
      namn: 'Cathedral',
      text: 'Deep blue and gold, like evening light through stained glass.',
    },
    sammet: {
      namn: 'Velvet',
      text: 'Wine red and old gold, like the curtain of an opera house.',
    },
    nocturne: {
      namn: 'Nocturne',
      text: 'Cool blue-grey with a silver tint. Restful for the eyes late at night.',
    },
    notblad: {
      namn: 'Sheet music',
      text: 'Bright manuscript paper with ink red. Light enough for daytime rehearsal.',
    },
    flygel: {
      namn: 'Grand piano',
      text: 'Black and white with brass, like a piano lid and its fittings.',
    },
    pergament: {
      namn: 'Parchment',
      text: 'Warm sepia with high contrast. Readable even in bright sunlight.',
    },
  },
};
