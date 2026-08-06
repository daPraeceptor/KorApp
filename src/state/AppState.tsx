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
import AsyncStorage from '@react-native-async-storage/async-storage';

import { audioEngine } from '../audio/engine';
import { DEFAULT_TIMBRE, TimbreId } from '../audio/timbres';
import { metronome } from '../audio/metronome';
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
  orderTones,
  parseFolders,
  parseLibrary,
  sortFolders,
  sortSongs,
  toggleTone,
  withValidFolders,
} from '../store/songs';

export type { PlayDirection } from '../store/songs';

const SONGS_KEY = 'korapp.songs.v1';
const SETTINGS_KEY = 'korapp.settings.v1';
const FOLDERS_KEY = 'korapp.folders.v1';

export interface Settings {
  /** Kammartonens frekvens. Många orglar och blåsorkestrar ligger på 442. */
  a4: number;
  naming: NoteNaming;
  volume: number;
  /**
   * Standardhastighet för tongivningen. Varje låt bär sitt eget värde; det här
   * är vad en ny låt börjar med.
   */
  defaultToneGapBpm: number;
  /** Om tonnamn skrivs ut på klaviaturens tangenter. */
  showNoteNames: boolean;
  /** Bokstäver, solmisation eller romerska tonplatssiffror. */
  labelSystem: LabelSystem;
  /** Om solmisation och tonplatser räknas från C eller från tonikan. */
  labelReference: LabelReference;
  /**
   * Om tonikatangenten märks ut även i tempererad stämning. I ren stämning
   * märks den alltid ut, eftersom allt annat stäms mot den.
   */
  markTonicInTempered: boolean;
  /** Klangfärg för tongivningen och klaviaturen. */
  toneTimbre: TimbreId;
  /** Appens färgtema. */
  themeId: ThemeId;
  /** Hur takten visas grafiskt i spelvyn. */
  metronomeVisual: MetronomeVisualStyle;
}

/** Klassisk pendel, streck fram och tillbaka, studsande boll, eller ingen alls. */
export type MetronomeVisualStyle = 'pendulum' | 'bar' | 'ball' | 'none';

const DEFAULT_SETTINGS: Settings = {
  a4: DEFAULT_A4,
  naming: 'international',
  volume: 0.8,
  defaultToneGapBpm: DEFAULT_TONE_GAP_BPM,
  showNoteNames: true,
  labelSystem: 'letters',
  labelReference: 'tonic',
  markTonicInTempered: false,
  toneTimbre: DEFAULT_TIMBRE,
  themeId: DEFAULT_THEME,
  metronomeVisual: 'pendulum',
};


/** De värden spelvyn arbetar med just nu. */
export interface LiveConfig {
  bpm: number;
  beatsPerBar: number;
  subdivision: number;
  tuningSystem: TuningSystem;
  tonicPitchClass: number;
  tones: number[];
  toneGapBpm: number;
}

const DEFAULT_LIVE: LiveConfig = {
  bpm: 90,
  beatsPerBar: 4,
  subdivision: 1,
  tuningSystem: 'tempered',
  tonicPitchClass: 0,
  tones: [],
  toneGapBpm: DEFAULT_TONE_GAP_BPM,
};

function liveFromSong(song: Song): LiveConfig {
  return {
    bpm: song.bpm,
    beatsPerBar: song.beatsPerBar,
    subdivision: song.subdivision,
    tuningSystem: song.tuningSystem,
    tonicPitchClass: song.tonicPitchClass,
    tones: [...song.tones],
    toneGapBpm: song.toneGapBpm,
  };
}

/** Ett hört taktslag: vilken taktdel, när det inföll, och hur många i rad. */
export interface BeatPulse {
  beat: number;
  at: number;
  count: number;
}

/** Det som behövs för att kunna ge en uppsättning toner i rätt stämning och puls. */
export interface ToneSource {
  tones: number[];
  tuningSystem: TuningSystem;
  tonicPitchClass: number;
  toneGapBpm: number;
}

function liveMatchesSong(live: LiveConfig, song: Song): boolean {
  return (
    live.bpm === song.bpm &&
    live.beatsPerBar === song.beatsPerBar &&
    live.subdivision === song.subdivision &&
    live.tuningSystem === song.tuningSystem &&
    live.tonicPitchClass === song.tonicPitchClass &&
    live.toneGapBpm === song.toneGapBpm &&
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
  /** Taktdelen som just hörs, för den visuella markeringen. */
  activeBeat: number | null;
  /** Senaste taktslaget med tidpunkt, så att animeringar kan följa ljudet. */
  pulse: BeatPulse | null;
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
  moveSongToFolder: (songId: string, folderId: string | null) => void;

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
  const [metronomeRunning, setMetronomeRunning] = useState(false);
  const [pulse, setPulse] = useState<BeatPulse | null>(null);

  // Undviker att skriva tillbaka det inlästa värdet direkt efter start.
  const hydrated = useRef(false);

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
        const laddadeMappar = sortFolders(parseFolders(foldersJson));
        setFolders(laddadeMappar);
        // Låtar vars mapp saknas hamnar löst i listan i stället för att döljas.
        setSongs(sortSongs(withValidFolders(parseLibrary(songsJson), laddadeMappar)));
        if (settingsJson) {
          try {
            const parsed = JSON.parse(settingsJson) as Partial<Settings>;
            setSettings((current) => ({ ...current, ...parsed }));
            // Utan laddad låt utgår spelvyn från standardhastigheten.
            if (typeof parsed.defaultToneGapBpm === 'number') {
              setLive((current) => ({
                ...current,
                toneGapBpm: parsed.defaultToneGapBpm as number,
              }));
            }
          } catch {
            // Trasiga inställningar ersätts av standardvärdena.
          }
        }
      } finally {
        if (!cancelled) {
          hydrated.current = true;
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    void AsyncStorage.setItem(SONGS_KEY, JSON.stringify(songs));
  }, [songs]);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    void AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    audioEngine.setVolume(settings.volume);
  }, [settings.volume]);

  useEffect(() => {
    audioEngine.setTimbre(settings.toneTimbre);
  }, [settings.toneTimbre]);

  useEffect(() => {
    metronome.update({
      bpm: live.bpm,
      beatsPerBar: live.beatsPerBar,
      subdivision: live.subdivision,
    });
  }, [live.bpm, live.beatsPerBar, live.subdivision]);

  useEffect(() => {
    metronome.onBeat = (beat) =>
      setPulse((previous) => ({
        beat,
        at: Date.now(),
        // Löpande räknare, till skillnad från taktdelen som börjar om varje takt.
        // Pendeln behöver veta åt vilket håll den ska svänga.
        count: (previous?.count ?? -1) + 1,
      }));
    return () => {
      metronome.onBeat = null;
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

  const activeBeat = pulse ? pulse.beat : null;

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
    const running = await metronome.toggle();
    setMetronomeRunning(running);
    if (!running) {
      setPulse(null);
    }
  }, []);

  const stopMetronome = useCallback(() => {
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
          spacing: 60 / from.toneGapBpm,
        },
      );
    },
    [live, settings.a4],
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

  const moveSongToFolder = useCallback((songId: string, folderId: string | null) => {
    setSongs((current) =>
      current.map((song) =>
        song.id === songId ? { ...song, folderId, updatedAt: Date.now() } : song,
      ),
    );
  }, []);

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
      await metronome.start();
      setMetronomeRunning(true);
    },
    [],
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
      activeBeat,
      pulse,
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
      moveSongToFolder,
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
      activeBeat,
      pulse,
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
      moveSongToFolder,
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
