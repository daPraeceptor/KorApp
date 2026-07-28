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

import { ToneMode, audioEngine } from '../audio/engine';
import { metronome } from '../audio/metronome';
import {
  DEFAULT_A4,
  NoteNaming,
  TuningConfig,
  TuningSystem,
  frequencyOf,
} from '../theory/tuning';
import {
  Song,
  createSong,
  parseLibrary,
  sortSongs,
  toggleTone,
} from '../store/songs';

const SONGS_KEY = 'korapp.songs.v1';
const SETTINGS_KEY = 'korapp.settings.v1';

export interface Settings {
  /** Kammartonens frekvens. Många orglar och blåsorkestrar ligger på 442. */
  a4: number;
  naming: NoteNaming;
  volume: number;
  /**
   * Vad som styr mellanrummet när tonerna ges en och en: ett fast tempo, eller
   * låtens eget tempo så att tongivningen går i samma puls som stycket.
   */
  arpeggioSource: 'fixed' | 'song';
  /** Tempot för mellanrummet när arpeggioSource är 'fixed'. */
  arpeggioBpm: number;
}

const DEFAULT_SETTINGS: Settings = {
  a4: DEFAULT_A4,
  naming: 'swedish',
  volume: 0.8,
  arpeggioSource: 'fixed',
  arpeggioBpm: 80,
};

/** De värden spelvyn arbetar med just nu. */
export interface LiveConfig {
  bpm: number;
  beatsPerBar: number;
  subdivision: number;
  tuningSystem: TuningSystem;
  tonicPitchClass: number;
  tones: number[];
}

const DEFAULT_LIVE: LiveConfig = {
  bpm: 90,
  beatsPerBar: 4,
  subdivision: 1,
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

/** Det som behövs för att kunna ge en uppsättning toner i rätt stämning och puls. */
export interface ToneSource {
  tones: number[];
  tuningSystem: TuningSystem;
  tonicPitchClass: number;
  bpm: number;
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

  /** Sant medan metronomen går, oavsett vilken vy som startade den. */
  metronomeRunning: boolean;
  /** Taktdelen som just hörs, för den visuella markeringen. */
  activeBeat: number | null;
  toggleMetronome: () => Promise<void>;
  stopMetronome: () => void;
  /**
   * Ger tonerna till kören. Utan källa används det som ligger i spelvyn;
   * med en källa spelas den låtens toner i den låtens stämning.
   */
  playTones: (mode: ToneMode, source?: ToneSource) => void;
  stopTones: () => void;
  /** Laddar låten och startar dess tempo direkt. */
  playSongTempo: (song: Song) => Promise<void>;

  updateLive: (patch: Partial<LiveConfig>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  toggleSongTone: (midi: number) => void;

  loadSong: (id: string) => void;
  saveToCurrentSong: () => void;
  addSong: (title: string) => Song;
  updateSong: (id: string, patch: Partial<Song>) => void;
  deleteSong: (id: string) => void;
  clearCurrentSong: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [live, setLive] = useState<LiveConfig>(DEFAULT_LIVE);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [metronomeRunning, setMetronomeRunning] = useState(false);
  const [activeBeat, setActiveBeat] = useState<number | null>(null);

  // Undviker att skriva tillbaka det inlästa värdet direkt efter start.
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [songsJson, settingsJson] = await Promise.all([
          AsyncStorage.getItem(SONGS_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
        ]);
        if (cancelled) {
          return;
        }
        setSongs(sortSongs(parseLibrary(songsJson)));
        if (settingsJson) {
          try {
            const parsed = JSON.parse(settingsJson) as Partial<Settings>;
            setSettings((current) => ({ ...current, ...parsed }));
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
    void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    audioEngine.setVolume(settings.volume);
  }, [settings.volume]);

  useEffect(() => {
    metronome.update({
      bpm: live.bpm,
      beatsPerBar: live.beatsPerBar,
      subdivision: live.subdivision,
    });
  }, [live.bpm, live.beatsPerBar, live.subdivision]);

  useEffect(() => {
    metronome.onBeat = (beat) => setActiveBeat(beat);
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
      setActiveBeat(null);
    }
  }, []);

  const stopMetronome = useCallback(() => {
    metronome.stop();
    setMetronomeRunning(false);
    setActiveBeat(null);
  }, []);

  const playTones = useCallback(
    (mode: ToneMode, source?: ToneSource) => {
      const from = source ?? live;
      if (from.tones.length === 0) {
        return;
      }
      const toneTuning: TuningConfig = {
        system: from.tuningSystem,
        tonicPitchClass: from.tonicPitchClass,
        a4: settings.a4,
      };
      // När mellanrummet följer låten används tempot från den låt tonerna kom ifrån.
      const bpm =
        settings.arpeggioSource === 'song' ? from.bpm : settings.arpeggioBpm;

      void audioEngine.playTones(
        from.tones.map((midi) => frequencyOf(midi, toneTuning)),
        { mode, spacing: 60 / bpm },
      );
    },
    [live, settings.a4, settings.arpeggioBpm, settings.arpeggioSource],
  );

  const stopTones = useCallback(() => audioEngine.stopTones(), []);

  const updateLive = useCallback((patch: Partial<LiveConfig>) => {
    setLive((current) => ({ ...current, ...patch }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const toggleSongTone = useCallback((midi: number) => {
    setLive((current) => ({ ...current, tones: toggleTone(current.tones, midi) }));
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
    (title: string) => {
      const song = createSong({ title: title.trim() || 'Ny låt', ...live });
      setSongs((current) => sortSongs([...current, song]));
      setCurrentSongId(song.id);
      return song;
    },
    [live],
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
      metronomeRunning,
      activeBeat,
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
      metronomeRunning,
      activeBeat,
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
      addSong,
      updateSong,
      deleteSong,
      clearCurrentSong,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error('useAppState måste användas inuti AppStateProvider.');
  }
  return value;
}
