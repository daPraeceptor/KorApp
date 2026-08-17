/**
 * Delat tillstånd för hela appen: låtbiblioteket, inställningar och den
 * uppsättning värden som just nu är laddad i spelvyn.
 *
 * Spelvyns värden hålls skilda från den sparade låten, så att körledaren kan
 * skruva på tempot under repetitionen utan att skriva över det sparade tempot
 * förrän hen väljer att spara.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { setHapticsEnabled } from '../haptics';

import { audioEngine } from '../audio/engine';
import { observeSystemVolume } from '../audio/systemVolume';
import { DEFAULT_TIMBRE, TimbreId } from '../audio/timbres';
import { DEFAULT_FOLDERS, DEFAULT_SONGS } from '../store/defaultSongs';
import { metronome } from '../audio/metronome';
import { DEFAULT_SUBDIVISION, SubdivisionId } from '../audio/subdivisions';
import { ThemeProvider } from '../ThemeContext';
import { DEFAULT_THEME, ThemeId, buildPalette } from '../theme';
import {
  DEFAULT_A4,
  LabelConfig,
  LabelReference,
  LabelSystem,
  NoteNaming,
  TuningConfig,
  TuningSystem,
  frequencyOf,
} from '../theory/tuning';
import {
  DEFAULT_TONE_GAP_BPM,
  Folder,
  PlayDirection,
  Song,
  createFolder,
  createSong,
  moveSongInFolder as flyttaILista,
  orderTones,
  placeSongInFolder,
  parseFolders,
  parseLibrary,
  sortFolders,
  sortSongs,
  toggleTone,
  withValidFolders,
} from '../store/songs';

import {
  MAX_AUTO_STOP_BEATS,
  MIN_AUTO_STOP_BEATS,
  type MetronomeVisualStyle,
  type Settings,
  type StartTab,
  SENASTE_MIGRATION,
  parseSettings,
} from './settings';
import { setPulse } from './pulse';

export type { PlayDirection } from '../store/songs';
export type { MetronomeVisualStyle, Settings, StartTab } from './settings';
export { MAX_AUTO_STOP_BEATS, MIN_AUTO_STOP_BEATS } from './settings';

/** Eget namn på vakenhetslåset, så att bara vår egen låsning släpps. */
const KEEP_AWAKE_TAG = 'korapp-metronom';

/**
 * Hur länge en ändring får ligga och vänta innan den skrivs till lagringen.
 *
 * Varje ändring skriver hela biblioteket. Utan fördröjning betyder det en
 * fullständig sparning per tangenttryck i en titel, och en per granne man
 * drar en låt förbi — hundratals kilobyte i sekunden för något som ändå
 * bara behöver stå rätt när appen stängs.
 */
const SPARFÖRDRÖJNING_MS = 400;

/**
 * Sparar till lagringen, men inte oftare än nödvändigt. Sista värdet vinner,
 * och en sista skrivning görs alltid — annars skulle den senaste ändringen
 * kunna bli kvar i väntan när appen läggs undan.
 */
function useFördröjdSparning<T>(nyckel: string, värde: T, aktiv: boolean): void {
  const senaste = useRef(värde);
  const aktivNu = useRef(aktiv);
  senaste.current = värde;
  aktivNu.current = aktiv;

  useEffect(() => {
    if (!aktiv) {
      return;
    }
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(nyckel, JSON.stringify(senaste.current));
    }, SPARFÖRDRÖJNING_MS);
    return () => clearTimeout(timer);
  }, [nyckel, värde, aktiv]);

  // Appen kan stängas mitt i väntan. Då skrivs det som ligger och väntar direkt.
  useEffect(
    () => () => {
      if (aktivNu.current) {
        void AsyncStorage.setItem(nyckel, JSON.stringify(senaste.current));
      }
    },
    [nyckel],
  );
}

const SONGS_KEY = 'korapp.songs.v1';
const SETTINGS_KEY = 'korapp.settings.v1';
const FOLDERS_KEY = 'korapp.folders.v1';

const DEFAULT_SETTINGS: Settings = {
  a4: DEFAULT_A4,
  naming: 'international',
  // iOS-högtalarna är starka nog att halv volym räcker som utgångsläge.
  volume: Platform.OS === 'ios' ? 0.5 : 0.8,
  defaultToneGapBpm: DEFAULT_TONE_GAP_BPM,
  showNoteNames: true,
  labelSystem: 'letters',
  labelReference: 'tonic',
  markTonicInTempered: false,
  toneTimbre: DEFAULT_TIMBRE,
  themeId: DEFAULT_THEME,
  showAdvancedSubdivisions: false,
  metronomeVisual: 'ball',
  startTab: 'auto',
  autoStopFromList: false,
  autoStopBeats: 16,
  accentFirstBeat: true,
  haptics: true,
  keepAwake: true,
  tonesFirst: false,
  // En ny installation har inget gammalt val att skriva om.
  migrationer: SENASTE_MIGRATION,
};

/** De värden spelvyn arbetar med just nu. */
export interface LiveConfig {
  bpm: number;
  beatsPerBar: number;
  subdivision: SubdivisionId;
  tuningSystem: TuningSystem;
  tonicPitchClass: number;
  tones: number[];
}

const DEFAULT_LIVE: LiveConfig = {
  bpm: 90,
  beatsPerBar: 4,
  subdivision: DEFAULT_SUBDIVISION,
  tuningSystem: 'tempered',
  tonicPitchClass: 0,
  tones: [],
};

function liveFromSong(song: Song): LiveConfig {
  return {
    bpm: song.bpm,
    beatsPerBar: song.beatsPerBar,
    subdivision: song.subdivision,
    tuningSystem: song.tuningSystem,
    tonicPitchClass: song.tonicPitchClass,
    tones: [...song.tones],
  };
}

export type { BeatPulse } from './pulse';
export { usePulse } from './pulse';

/**
 * Taktslagen skrivs till sin egen butik i stället för till tillståndet här.
 * Det är den som gör att en lista på hundratals låtar kan ligga framme medan
 * metronomen går: bara det som faktiskt ritar takten ritas om.
 */

/** Det som behövs för att kunna ge en uppsättning toner i rätt stämning. */
export interface ToneSource {
  tones: number[];
  tuningSystem: TuningSystem;
  tonicPitchClass: number;
}

function liveMatchesSong(live: LiveConfig, song: Song): boolean {
  return (
    live.bpm === song.bpm &&
    live.beatsPerBar === song.beatsPerBar &&
    live.subdivision === song.subdivision &&
    live.tuningSystem === song.tuningSystem &&
    live.tonicPitchClass === song.tonicPitchClass &&
    live.tones.length === song.tones.length &&
    live.tones.every((tone, index) => tone === song.tones[index])
  );
}

interface AppStateValue {
  loaded: boolean;
  songs: Song[];
  settings: Settings;
  live: LiveConfig;
  currentSong: Song | null;
  /** Sant när spelvyns värden avviker från den laddade låten. */
  hasUnsavedChanges: boolean;
  tuning: TuningConfig;
  /** Färdig uppsättning för att skriva ut tonnamn i valt system. */
  labels: LabelConfig;

  /** Sant medan metronomen går, oavsett vilken vy som startade den. */
  metronomeRunning: boolean;
  // Taktslagen ligger inte här utan hämtas med usePulse, av var och en som
  // faktiskt ritar takten. De kommer flera gånger i sekunden, och låg de i
  // det delade tillståndet skulle hela appen ritas om i samma takt.
  /**
   * Telefonens egen ljudnivå, 0–1, eller null så länge den är okänd. iOS
   * berättar bara när den ändras, så värdet saknas tills någon rör
   * volymknapparna — och webben får aldrig veta något alls.
   */
  systemVolume: number | null;
  toggleMetronome: () => Promise<void>;
  stopMetronome: () => void;
  /**
   * Ger tonerna till kören. Utan källa används det som ligger i spelvyn;
   * med en källa spelas den låtens toner i den låtens stämning.
   */
  playTones: (direction: PlayDirection, source?: ToneSource) => void;
  stopTones: () => void;
  /** Laddar låten och startar dess tempo direkt. */
  playSongTempo: (song: Song) => Promise<void>;

  updateLive: (patch: Partial<LiveConfig>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  toggleSongTone: (midi: number) => void;

  loadSong: (id: string) => void;
  saveToCurrentSong: () => void;
  folders: Folder[];
  addFolder: (name: string) => Folder;
  renameFolder: (id: string, name: string) => void;
  /** Tar bort mappen. Låtarna i den blir kvar men hamnar löst i listan. */
  deleteFolder: (id: string) => void;
  /** Tar bort mappen tillsammans med alla låtar i den. */
  deleteFolderAndSongs: (id: string) => void;
  /** Flyttar låten till mappen (null = utanför), på vald plats i gruppen. */
  moveSongToFolder: (
    songId: string,
    folderId: string | null,
    position?: number,
  ) => void;
  /** Flyttar låten ett steg upp (-1) eller ner (1) bland grannarna i mappen. */
  moveSongInFolder: (songId: string, direction: -1 | 1) => void;

  addSong: (title: string) => Song;
  updateSong: (id: string, patch: Partial<Song>) => void;
  deleteSong: (id: string) => void;
  clearCurrentSong: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [live, setLive] = useState<LiveConfig>(DEFAULT_LIVE);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [systemVolume, setSystemVolume] = useState<number | null>(null);
  const [metronomeRunning, setMetronomeRunning] = useState(false);

  /**
   * Slag kvar innan metronomen stoppar sig själv, eller null när den ska
   * gå tills någon säger till. Armeras bara av starter från låtlistan.
   */
  const autoStopLeft = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [songsJson, settingsJson, foldersJson] = await Promise.all([
          AsyncStorage.getItem(SONGS_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(FOLDERS_KEY),
        ]);
        if (cancelled) {
          return;
        }
        /**
         * Mapparna följer med låtarna: startbiblioteket ligger i en mapp, och
         * utan den skulle låtarna hamna lösa i listan vid första starten.
         * Samma villkor som för låtarna — bara en orörd lagring får dem.
         */
        const laddadeMappar = sortFolders(
          foldersJson === null ? DEFAULT_FOLDERS : parseFolders(foldersJson),
        );
        setFolders(laddadeMappar);
        /**
         * Bara en orörd lagring får de medföljande låtarna. Har appen skrivit
         * en gång står det "[]" här, och ett tomt bibliotek betyder att man
         * tagit bort dem med flit — då ska de inte komma tillbaka.
         */
        const laddadeLatar =
          songsJson === null ? DEFAULT_SONGS : parseLibrary(songsJson);
        // Låtar vars mapp saknas hamnar löst i listan i stället för att döljas.
        setSongs(sortSongs(withValidFolders(laddadeLatar, laddadeMappar)));
        // Varje fält prövas för sig: ett värde som inte går att känna igen
        // faller tillbaka på standardvärdet i stället för att följa med in i
        // appen. Ett tokigt värde ska inte kunna tysta ljudet.
        setSettings((current) => parseSettings(settingsJson, current));
      } finally {
        // Först här börjar skrivningarna gälla, så att inläsningen inte
        // skriver tillbaka standardvärdena ovanpå det som redan står sparat.
        if (!cancelled) {
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Skrivningarna väntar en kort stund och slår ihop det som hinner ändras
  // under tiden. En dragning i listan flyttar en låt förbi en granne i taget,
  // och varje bokstav i en titel är en ändring — utan fördröjning skulle
  // hela biblioteket skrivas om för vart och ett av dem.
  useFördröjdSparning(SONGS_KEY, songs, loaded);
  useFördröjdSparning(FOLDERS_KEY, folders, loaded);
  useFördröjdSparning(SETTINGS_KEY, settings, loaded);

  useEffect(() => {
    audioEngine.setVolume(settings.volume);
  }, [settings.volume]);

  useEffect(() => {
    audioEngine.setTimbre(settings.toneTimbre);
    // Klanger som spelar inspelade prov hämtar hem dem redan nu, så att den
    // första tangenten hörs lika snabbt som alla följande.
    void audioEngine.förberedKlang().catch(() => {});
  }, [settings.toneTimbre]);

  useEffect(() => {
    metronome.update({
      bpm: live.bpm,
      beatsPerBar: live.beatsPerBar,
      subdivision: live.subdivision,
    });
  }, [live.bpm, live.beatsPerBar, live.subdivision]);

  useEffect(() => {
    metronome.update({ accentFirstBeat: settings.accentFirstBeat });
  }, [settings.accentFirstBeat]);

  useEffect(() => observeSystemVolume(setSystemVolume), []);

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);

  /**
   * Håller skärmen tänd medan metronomen går. Låset släpps så fort den
   * stoppas — appen ska inte hindra telefonen från att somna i onödan.
   */
  useEffect(() => {
    if (!settings.keepAwake || !metronomeRunning) {
      return;
    }
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      try {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        // Vissa plattformar saknar stödet. Att skärmen slocknar är inget fel.
      }
    };
  }, [settings.keepAwake, metronomeRunning]);

  useEffect(() => {
    metronome.onBeat = (beat) => {
      setPulse((previous) => ({
        beat,
        at: Date.now(),
        // Löpande räknare, till skillnad från taktdelen som börjar om varje takt.
        // Pendeln behöver veta åt vilket håll den ska svänga.
        count: (previous?.count ?? -1) + 1,
      }));
    };

    // Automatstoppet räknar varje hörbart klick — slag, inte taktslag — så
    // att sexton slag alltid är sexton ljud, även med underdelningar. Det
    // räknar bara när starten kom från låtlistan. Gränsen och påslaget läses
    // ur refar: hanteraren sätts en gång och skulle annars frysa fast de
    // värden inställningarna hade vid starten.
    metronome.onClick = () => {
      if (autoStopLeft.current === null) {
        return;
      }
      autoStopLeft.current -= 1;
      if (autoStopLeft.current <= 0) {
        autoStopLeft.current = null;
        metronome.stop();
        setMetronomeRunning(false);
        setPulse(null);
      }
    };
    return () => {
      metronome.onBeat = null;
      metronome.onClick = null;
      metronome.stop();
      audioEngine.stopTones();
      audioEngine.stopAllVoices();
    };
  }, []);

  const currentSong = useMemo(
    () => songs.find((song) => song.id === currentSongId) ?? null,
    [songs, currentSongId],
  );

  const hasUnsavedChanges = currentSong ? !liveMatchesSong(live, currentSong) : false;


  // Paletten byggs om bara när temat byts, inte vid varje omritning.
  const palette = useMemo(() => buildPalette(settings.themeId), [settings.themeId]);

  const tuning = useMemo<TuningConfig>(
    () => ({
      system: live.tuningSystem,
      tonicPitchClass: live.tonicPitchClass,
      a4: settings.a4,
    }),
    [live.tuningSystem, live.tonicPitchClass, settings.a4],
  );

  const toggleMetronome = useCallback(async () => {
    // Starter härifrån kommer från spelvyn och ska gå tills man säger till.
    autoStopLeft.current = null;
    const running = await metronome.toggle();
    setMetronomeRunning(running);
    if (!running) {
      setPulse(null);
    }
  }, []);

  const stopMetronome = useCallback(() => {
    autoStopLeft.current = null;
    metronome.stop();
    setMetronomeRunning(false);
    setPulse(null);
  }, []);

  const playTones = useCallback(
    (direction: PlayDirection, source?: ToneSource) => {
      const from = source ?? live;
      if (from.tones.length === 0) {
        return;
      }
      const toneTuning: TuningConfig = {
        system: from.tuningSystem,
        tonicPitchClass: from.tonicPitchClass,
        a4: settings.a4,
      };
      const sequence = orderTones(from.tones, direction);

      void audioEngine.playTones(
        sequence.map((midi) => frequencyOf(midi, toneTuning)),
        {
          mode: direction === 'chord' ? 'together' : 'sequence',
          spacing: 60 / settings.defaultToneGapBpm,
        },
      );
    },
    [live, settings.a4, settings.defaultToneGapBpm],
  );

  const stopTones = useCallback(() => audioEngine.stopTones(), []);

  const labels = useMemo<LabelConfig>(
    () => ({
      system: settings.labelSystem,
      naming: settings.naming,
      reference: settings.labelReference,
      tonicPitchClass: live.tonicPitchClass,
    }),
    [settings.labelSystem, settings.naming, settings.labelReference, live.tonicPitchClass],
  );

  const updateLive = useCallback((patch: Partial<LiveConfig>) => {
    setLive((current) => ({ ...current, ...patch }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const toggleSongTone = useCallback((midi: number) => {
    setLive((current) => ({
      ...current,
      tones: toggleTone(current.tones, midi),
    }));
  }, []);

  const loadSong = useCallback(
    (id: string) => {
      const song = songs.find((candidate) => candidate.id === id);
      if (!song) {
        return;
      }
      setCurrentSongId(id);
      setLive(liveFromSong(song));
    },
    [songs],
  );

  const saveToCurrentSong = useCallback(() => {
    if (!currentSongId) {
      return;
    }
    setSongs((current) =>
      sortSongs(
        current.map((song) =>
          song.id === currentSongId
            ? { ...song, ...live, tones: [...live.tones], updatedAt: Date.now() }
            : song,
        ),
      ),
    );
  }, [currentSongId, live]);

  const addSong = useCallback(
    (title: string, folderId: string | null = null) => {
      const song = createSong({ title: title.trim() || 'Ny låt', ...live, folderId });
      setSongs((current) => sortSongs([...current, song]));
      setCurrentSongId(song.id);
      return song;
    },
    [live],
  );

  const addFolder = useCallback((name: string) => {
    const folder = createFolder(name);
    setFolders((current) => sortFolders([...current, folder]));
    return folder;
  }, []);

  const renameFolder = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setFolders((current) =>
      sortFolders(
        current.map((folder) =>
          folder.id === id ? { ...folder, name: trimmed } : folder,
        ),
      ),
    );
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders((current) => current.filter((folder) => folder.id !== id));
    // Låtarna följer inte med i fallet. De blir kvar, löst i listan.
    setSongs((current) =>
      current.map((song) =>
        song.folderId === id ? { ...song, folderId: null } : song,
      ),
    );
  }, []);

  /** Tar bort mappen och alla låtar i den. Den laddade följer med i fallet. */
  const deleteFolderAndSongs = useCallback(
    (id: string) => {
      setFolders((current) => current.filter((folder) => folder.id !== id));
      setSongs((current) => current.filter((song) => song.folderId !== id));
      setCurrentSongId((laddad) =>
        laddad !== null &&
        songs.some((song) => song.id === laddad && song.folderId === id)
          ? null
          : laddad,
      );
    },
    [songs],
  );

  const moveSongToFolder = useCallback(
    (songId: string, folderId: string | null, position?: number) => {
      setSongs((current) =>
        sortSongs(placeSongInFolder(current, songId, folderId, position)),
      );
    },
    [],
  );

  /**
   * Flyttar en låt ett steg bland sina grannar i samma mapp. Dragningen i
   * listan ropar hit varje gång fingret passerat en granne, så att grannarna
   * flyter undan och ger plats åt det man drar.
   */
  const moveSongInFolder = useCallback(
    (songId: string, direction: -1 | 1) => {
      setSongs((current) => sortSongs(flyttaILista(current, songId, direction)));
    },
    [],
  );

  const updateSong = useCallback((id: string, patch: Partial<Song>) => {
    setSongs((current) =>
      sortSongs(
        current.map((song) =>
          song.id === id ? { ...song, ...patch, updatedAt: Date.now() } : song,
        ),
      ),
    );
  }, []);

  const deleteSong = useCallback(
    (id: string) => {
      setSongs((current) => current.filter((song) => song.id !== id));
      setCurrentSongId((current) => (current === id ? null : current));
    },
    [],
  );

  const clearCurrentSong = useCallback(() => setCurrentSongId(null), []);

  const playSongTempo = useCallback(
    async (song: Song) => {
      // Ladda låten först, så att spelvyn visar samma tempo som hörs.
      setCurrentSongId(song.id);
      setLive(liveFromSong(song));
      metronome.update({
        bpm: song.bpm,
        beatsPerBar: song.beatsPerBar,
        subdivision: song.subdivision,
      });

      if (metronome.isRunning) {
        metronome.stop();
      }
      // Nedräkningen armeras bara här, alltså bara för starter från listan.
      autoStopLeft.current = settings.autoStopFromList
        ? settings.autoStopBeats
        : null;
      await metronome.start();
      setMetronomeRunning(true);
    },
    [settings.autoStopFromList, settings.autoStopBeats],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      loaded,
      songs,
      settings,
      live,
      currentSong,
      hasUnsavedChanges,
      tuning,
      labels,
      metronomeRunning,
      systemVolume,
      toggleMetronome,
      stopMetronome,
      playTones,
      stopTones,
      playSongTempo,
      updateLive,
      updateSettings,
      toggleSongTone,
      loadSong,
      saveToCurrentSong,
      folders,
      addFolder,
      renameFolder,
      deleteFolder,
      deleteFolderAndSongs,
      moveSongToFolder,
      moveSongInFolder,
      addSong,
      updateSong,
      deleteSong,
      clearCurrentSong,
    }),
    [
      loaded,
      songs,
      settings,
      live,
      currentSong,
      hasUnsavedChanges,
      tuning,
      labels,
      metronomeRunning,
      systemVolume,
      toggleMetronome,
      stopMetronome,
      playTones,
      stopTones,
      playSongTempo,
      updateLive,
      updateSettings,
      toggleSongTone,
      loadSong,
      saveToCurrentSong,
      folders,
      addFolder,
      renameFolder,
      deleteFolder,
      deleteFolderAndSongs,
      moveSongToFolder,
      moveSongInFolder,
      addSong,
      updateSong,
      deleteSong,
      clearCurrentSong,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>
      <ThemeProvider palette={palette}>{children}</ThemeProvider>
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error('useAppState måste användas inuti AppStateProvider.');
  }
  return value;
}
