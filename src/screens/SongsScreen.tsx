/**
 * Låtbiblioteket: skapa, byta namn på, ladda och ta bort låtar.
 *
 * Låtar kan samlas i mappar — en per konsert, termin eller vad körledaren
 * behöver. Mappar är avsiktligt platta: en nivå räcker för ett repertoarregister,
 * och slipper man undermappar slipper man också fundera på var en låt tog vägen.
 */
import React, {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Button, Card, SectionTitle, SlideToConfirm } from '../components/ui';
import { Keyboard } from '../components/Keyboard';
import { MetronomeVisual } from '../components/MetronomeVisual';
import { BeatPulse, useAppState } from '../state/AppState';
import { Song, searchSongs } from '../store/songs';
import { noteName, noteNameWithOctave } from '../theory/tuning';
import { Palette, radius, spacing } from '../theme';
import { useTheme, useThemedStyles } from '../ThemeContext';

/**
 * Liten metronom som pendlar i låtens eget tempo. En blick över listan visar
 * hur låtarnas tempon förhåller sig till varandra, utan siffror.
 */
function MiniMetronome({
  bpm,
  color,
  pulse,
}: {
  bpm: number;
  color: string;
  /**
   * Senaste hörda taktslaget när den här låtens tempo spelas. Med det ankras
   * pendeln i ljudet och vänder precis på klicket — en fristående klocka
   * glider annars ur fas med det man hör.
   */
  pulse?: BeatPulse | null;
}) {
  const [, tick] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Ett slag per svängning från kant till kant, som på en riktig metronom.
  const beatMs = 60000 / bpm;
  let vinkel: number;
  if (pulse) {
    // Samma räkning som stora taktvisaren: andel av slaget sedan klicket,
    // med vändning i ytterläget precis på slaget.
    const fas = Math.min(Math.max((Date.now() - pulse.at) / beatMs, 0), 1);
    const riktning = pulse.count % 2 === 1 ? -1 : 1;
    vinkel = riktning * 0.42 * Math.cos(Math.PI * fas);
  } else {
    const beats = (Date.now() / 1000) * (bpm / 60);
    vinkel = Math.sin(Math.PI * beats) * 0.42;
  }
  const längd = 13;
  const toppX = 11 + längd * Math.sin(vinkel);
  const toppY = 17.5 - längd * Math.cos(vinkel);

  return (
    <Svg width={22} height={20} viewBox="0 0 22 20">
      {/* Kroppen: en låg trapets som antyder metronomlådan. */}
      <Path d="M7 19 L9.2 12 h3.6 L15 19 z" fill={color} opacity={0.35} />
      <Line
        x1={11}
        y1={17.5}
        x2={toppX}
        y2={toppY}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Circle
        cx={11 + (längd - 4) * Math.sin(vinkel)}
        cy={17.5 - (längd - 4) * Math.cos(vinkel)}
        r={2.1}
        fill={color}
      />
    </Svg>
  );
}

/** Greppet man drar i för att flytta en låt i ordningen. */
function GripIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      {[6, 10, 14].map((y) => (
        <React.Fragment key={y}>
          <Circle cx={7} cy={y} r={1.7} fill={color} />
          <Circle cx={13} cy={y} r={1.7} fill={color} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

/** Webbläsaren tolkar annars dragningen som en sidscroll. */
const WEB_DRAG_STYLE =
  Platform.OS === 'web'
    ? ({ touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle)
    : undefined;

/** Överstruken högtalare: metronomen går tyst. */
function MutedSpeakerIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M3 7.4 h3 L10.6 4 v12 L6 12.6 H3 z" fill={color} />
      <Line
        x1={13}
        y1={7.5}
        x2={17.5}
        y2={12.5}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line
        x1={17.5}
        y1={7.5}
        x2={13}
        y2={12.5}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Högtalare med ljudvågor: metronomen hörs. */
function SpeakerIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M3 7.4 h3 L10.6 4 v12 L6 12.6 H3 z" fill={color} />
      {[3.2, 6.2].map((r, i) => (
        <Path
          key={i}
          d={`M13 ${10 - r} A ${r} ${r} 0 0 1 13 ${10 + r}`}
          stroke={color}
          strokeWidth={1.9}
          strokeLinecap="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

export function SongsScreen({
  onOpenPlay,
  locked = false,
  onLock,
}: {
  onOpenPlay: () => void;
  /** I konsertläget går det bara att spela upp — inget går att ändra. */
  locked?: boolean;
  onLock?: () => void;
}) {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {
    songs,
    folders,
    currentSong,
    settings,
    metronomeRunning,
    pulse,
    loadSong,
    updateSong,
    deleteSong,
    addFolder,
    renameFolder,
    deleteFolder,
    moveSongToFolder,
    moveSongInFolder,
    playTones,
    playSongTempo,
    stopMetronome,
  } = useAppState();

  const [newFolderName, setNewFolderName] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  /** Låten vars kort är uppfällt med spelbart piano. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /**
   * Omflyttning genom dragning.
   *
   * Kortens höjder skiljer sig åt — ett uppfällt kort med piano är mångdubbelt
   * högre än ett hopfällt — och utan dem går det inte att veta när fingret
   * passerat en granne. Måtten tas med measureInWindow när greppet tas, inte
   * med onLayout: den senare avfyras aldrig för de här korten.
   */
  const cardRefs = useRef(new Map<string, View | null>());
  const heights = useRef(new Map<string, number>());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  /** Grannarnas ordning just nu, så att dragningen ser sina egna byten. */
  const dragGroup = useRef<string[]>([]);
  /** Hur långt de redan gjorda bytena flyttat kortet. */
  const dragCommitted = useRef(0);
  /** Varje låts grannar, uppdaterad vid utritningen och läst vid greppet. */
  const groupIds = useRef(new Map<string, string[]>());
  /**
   * En bestående responder per låt.
   *
   * Den får inte skapas om vid varje utritning: dragningen uppdaterar läget
   * för varje rörelse, och en ny responder mitt i greppet gör att gesten
   * tappas. Allt föränderligt läses därför ur refar i stället för att fångas
   * i slutningen.
   */
  const responders = useRef(
    new Map<string, ReturnType<typeof PanResponder.create>>(),
  );

  /** Grannens höjd, mätt på plats om måttet ännu inte hunnit fram. */
  const grannHöjd = (id: string) => {
    const känd = heights.current.get(id) ?? 0;
    if (känd > 0) {
      return känd;
    }
    cardRefs.current
      .get(id)
      ?.measureInWindow((_x, _y, _w, h) => heights.current.set(id, h));
    return 0;
  };

  const dragResponderFor = (songId: string) => {
    const redan = responders.current.get(songId);
    if (redan) {
      return redan;
    }
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const group = groupIds.current.get(songId) ?? [];
        // Mät hela gruppen nu: höjderna kan ha ändrats sedan sist, och de
        // behövs redan vid första rörelsen.
        group.forEach((id) =>
          cardRefs.current
            .get(id)
            ?.measureInWindow((_x, _y, _w, h) => heights.current.set(id, h)),
        );
        dragGroup.current = group;
        dragCommitted.current = 0;
        setDragOffset(0);
        setDraggingId(songId);
      },
      onPanResponderMove: (_event, gesture) => {
        const plats = dragGroup.current.indexOf(songId);
        const kvar = gesture.dy - dragCommitted.current;

        // Bytet sker när fingret passerat halva grannen — samma tröskel åt
        // båda håll, så att kortet inte fastnar mellan två lägen.
        const granne =
          kvar > 0 ? dragGroup.current[plats + 1] : dragGroup.current[plats - 1];
        const höjd = granne ? grannHöjd(granne) : 0;

        if (granne && höjd > 0 && Math.abs(kvar) > höjd / 2) {
          const riktning: -1 | 1 = kvar > 0 ? 1 : -1;
          moveSongInFolder(songId, riktning);
          const ny = [...dragGroup.current];
          [ny[plats], ny[plats + riktning]] = [ny[plats + riktning], ny[plats]];
          dragGroup.current = ny;
          dragCommitted.current += riktning * höjd;
        }
        setDragOffset(gesture.dy - dragCommitted.current);
      },
      onPanResponderRelease: () => {
        setDraggingId(null);
        setDragOffset(0);
      },
      onPanResponderTerminate: () => {
        setDraggingId(null);
        setDragOffset(0);
      },
    });
    responders.current.set(songId, responder);
    return responder;
  };
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [draftFolderName, setDraftFolderName] = useState('');
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(
    null,
  );

  const searching = query.trim().length > 0;
  const matches = useMemo(() => searchSongs(songs, query), [songs, query]);
  const loose = matches.filter((song) => song.folderId === null);

  // Halvfärdiga redigeringar stängs när låset slår till, annars står en
  // öppen namnruta kvar och går att skriva i fast läget är låst.
  useEffect(() => {
    if (locked) {
      setEditingId(null);
      setConfirmDeleteId(null);
      setMovingId(null);
      setEditingFolderId(null);
      setConfirmDeleteFolderId(null);
    }
  }, [locked]);

  const beginRename = (id: string, title: string) => {
    setEditingId(id);
    setDraftTitle(title);
    setConfirmDeleteId(null);
    setMovingId(null);
  };

  const commitRename = () => {
    if (editingId) {
      updateSong(editingId, { title: draftTitle.trim() || 'Namnlös låt' });
    }
    setEditingId(null);
  };

  const toggleFolder = (id: string) =>
    setCollapsed((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  /**
   * @param grupp låtarna i samma mapp, i visad ordning. Dragningen behöver
   *              känna sina grannar för att veta vad den byter plats med.
   */
  const renderSong = (song: Song, grupp: Song[] = []) => {
    const isCurrent = currentSong?.id === song.id;
    const isEditing = editingId === song.id;
    const isConfirming = confirmDeleteId === song.id;
    const isMoving = movingId === song.id;
    const isPlayingTempo = isCurrent && metronomeRunning;
    const isExpanded = expandedId === song.id;

    /**
     * I knappraden delar tempot bredden med tongivningen. Uppe i rubriken
     * ska det bara ta sin egen plats, så att taktvisaren får resten.
     */
    const tempoKnapp = (style: ViewStyle) => (
      <Button
        label={isPlayingTempo ? 'Stoppa tempo' : '▶ Tempo'}
        renderIcon={
          isPlayingTempo
            ? (color) => <MutedSpeakerIcon color={color} />
            : undefined
        }
        variant="primary"
        onPress={() =>
          isPlayingTempo ? stopMetronome() : void playSongTempo(song)
        }
        style={style}
      />
    );

    /**
     * Uppfälld låt visar takten även när den är tyst: bilden går på egen
     * klocka tills ljudet slås på, och låser sig då vid de hörda klicken.
     */
    const taktvisare = (
      <MetronomeVisual
        style={settings.metronomeVisual}
        running={isExpanded || isPlayingTempo}
        bpm={song.bpm}
        pulse={isPlayingTempo ? pulse : null}
        activeBeat={isPlayingTempo && pulse ? pulse.beat : null}
      />
    );

    /** Ikonen visar hur det låter nu; trycket byter läge. */
    const ljudKnapp = (
      <Button
        label={isPlayingTempo ? 'Tysta metronomen' : 'Låt metronomen höras'}
        renderIcon={(color) =>
          isPlayingTempo ? (
            <SpeakerIcon color={color} />
          ) : (
            <MutedSpeakerIcon color={color} />
          )
        }
        variant={isPlayingTempo ? 'primary' : 'default'}
        onPress={() =>
          isPlayingTempo ? stopMetronome() : void playSongTempo(song)
        }
        style={styles.headerTempo}
      />
    );

    const klaviatur =
      song.tones.length > 0 ? (
        <Keyboard
          fromMidi={Math.max(0, Math.min(...song.tones) - 2)}
          toMidi={Math.min(127, Math.max(...song.tones) + 2)}
          tuning={{
            system: song.tuningSystem,
            tonicPitchClass: song.tonicPitchClass,
            a4: settings.a4,
          }}
          labels={{
            system: settings.labelSystem,
            naming: settings.naming,
            reference: settings.labelReference,
            tonicPitchClass: song.tonicPitchClass,
          }}
          showLabels={settings.showNoteNames}
          // Grundtonen färgas inte här. Den är en av låtens toner, och med
          // grön grundton mitt bland de gula såg de fyra tonerna olika ut
          // fast de är samma sorts ton. Vilken grundtonen är står i raden
          // ovanför klaviaturen.
          markTonic={false}
          selectedTones={song.tones}
          selectMode={false}
          playableTones={song.tones}
          onSetTonic={() => {}}
          onToggleTone={() => {}}
        />
      ) : (
        <Text style={styles.help}>
          Inga sparade toner att spela. Lägg till toner via «Ändra».
        </Text>
      );

    const isDragging = draggingId === song.id;
    // Bara en grupp med flera låtar går att ordna om, och inte i konsertläget.
    const kanDras = !locked && grupp.length > 1;
    // Grannarna läses ur refen när greppet tas, så att respondern slipper
    // skapas om varje gång listan ritas.
    groupIds.current.set(song.id, grupp.map((s) => s.id));

    const underrubriker = (
      <>
        <Text style={styles.meta}>
          {song.bpm} slag/min · {song.beatsPerBar}/4 ·{' '}
          {song.tuningSystem === 'just'
            ? `ren, grundton ${noteName(song.tonicPitchClass, settings.naming)}`
            : 'tempererad'}
        </Text>
        {song.tones.length > 0 ? (
          <Text style={styles.tones}>
            Toner:{' '}
            {song.tones
              .map((midi) => noteNameWithOctave(midi, settings.naming))
              .join('  ')}
          </Text>
        ) : (
          <Text style={styles.tonesEmpty}>Inga sparade toner</Text>
        )}
      </>
    );

    return (
      /**
       * Höjden mäts på omslaget och inte på kortet: react-native-webs Pressable
       * skickar inte vidare onLayout, och kortet är en Pressable så fort det
       * går att trycka på. Utan måttet vet dragningen inte när fingret passerat
       * en granne.
       */
      <View
        key={song.id}
        ref={(el) => {
          cardRefs.current.set(song.id, el);
        }}
      >
      <Card
        // Den valda låten får accentramen — samma ram som när metronomen går.
        // Den dragna lyfts ur listan så att man ser vad man håller i.
        style={[
          isCurrent ? styles.currentCard : undefined,
          isDragging
            ? { ...styles.draggingCard, transform: [{ translateY: dragOffset }] }
            : undefined,
        ].reduce((a, b) => ({ ...a, ...b }), {})}
        // Ett tryck var som helst i rutan väljer låten och fäller upp pianot.
        // Trycket fäller aldrig ihop igen — den uppfällda rutan är full av
        // knappar och tangenter, och ett tryck bredvid dem skulle rycka undan
        // det man siktade på. Rutan stängs först när en annan låt väljs.
        onPress={() => {
          loadSong(song.id);
          setExpandedId(song.id);
        }}
      >
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              style={[styles.input, styles.editInput]}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={commitRename}
            />
            <Button label="Klart" variant="primary" onPress={commitRename} />
          </View>
        ) : (
          /**
           * Uppfälld ligger texten i en egen spalt till vänster: rubriken
           * högst upp med underrubrikerna direkt under. Taktvisaren tar
           * platsen som blir över och tempot står ytterst till höger.
           */
          <View style={isExpanded ? styles.expandedHeader : undefined}>
            <View style={isExpanded ? styles.headerText : undefined}>
              <View style={styles.titleRow}>
                {kanDras ? (
                  <View
                    style={[styles.grip, WEB_DRAG_STYLE]}
                    {...dragResponderFor(song.id).panHandlers}
                  >
                    <GripIcon color={isDragging ? t.accent : t.textMuted} />
                  </View>
                ) : null}
                {/* Uppfälld visar den stora taktvisaren i stället — då säger
                    den lilla ingenting nytt. */}
                {isExpanded ? null : (
                  <MiniMetronome
                    bpm={song.bpm}
                    color={isPlayingTempo ? t.accent : t.textMuted}
                    pulse={isPlayingTempo ? pulse : null}
                  />
                )}
                <Text style={styles.title} numberOfLines={2}>
                  {song.title}
                </Text>
              </View>
              {underrubriker}
            </View>
            {isExpanded ? (
              <>
                <View style={styles.headerMetronome}>{taktvisare}</View>
                {ljudKnapp}
              </>
            ) : null}
          </View>
        )}

        <View style={styles.quickRow}>
          {/* En ensam ton har varken ackord eller ordning — bara sig själv,
              och behöver därför bara en knapp. */}
          {song.tones.length > 1 ? (
            <>
              <Button
                label="♪ Ackord"
                variant="pure"
                onPress={() => playTones('chord', song)}
                style={styles.quickButton}
              />
              <Button
                label="♪ ↑"
                onPress={() => playTones('up', song)}
                style={styles.quickButton}
              />
              <Button
                label="♪ ↓"
                onPress={() => playTones('down', song)}
                style={styles.quickButton}
              />
              <Button
                label="♪ ⇢"
                onPress={() => playTones('chosen', song)}
                style={styles.quickButton}
              />
            </>
          ) : (
            <Button
              label={
                song.tones.length === 1
                  ? `♪ ${noteNameWithOctave(song.tones[0], settings.naming)}`
                  : '♪ Inga toner'
              }
              variant="pure"
              disabled={song.tones.length === 0}
              onPress={() => playTones('chord', song)}
              style={styles.quickButton}
            />
          )}
          {/* Tempot sist i raden: tongivningen hör ihop och ska stå samlad,
              och metronomen är det enda som fortsätter låta efter trycket.
              Uppfälld har knappen flyttat upp till taktvisaren i stället. */}
          {isExpanded ? null : tempoKnapp(styles.quickButton)}
        </View>

        {/* Uppfällt kort: ett piano där bara låtens toner går att spela, i
            låtens egen stämning. Ren uppspelning — inget går att ändra
            härifrån. Med plats står taktvisaren till höger om klaviaturen. */}
        {isExpanded ? klaviatur : null}

        {isMoving ? (
          <View style={styles.moveBox}>
            <Text style={styles.moveLabel}>Flytta till</Text>
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => {
                  moveSongToFolder(song.id, null);
                  setMovingId(null);
                }}
                style={[styles.chip, song.folderId === null && styles.chipOn]}
              >
                <Text
                  style={[
                    styles.chipText,
                    song.folderId === null && styles.chipTextOn,
                  ]}
                >
                  Ingen mapp
                </Text>
              </Pressable>
              {folders.map((folder) => (
                <Pressable
                  key={folder.id}
                  onPress={() => {
                    moveSongToFolder(song.id, folder.id);
                    setMovingId(null);
                  }}
                  style={[
                    styles.chip,
                    song.folderId === folder.id && styles.chipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      song.folderId === folder.id && styles.chipTextOn,
                    ]}
                  >
                    {folder.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            {folders.length === 0 ? (
              <Text style={styles.help}>
                Du har inga mappar än. Skapa en högst upp i listan.
              </Text>
            ) : null}
            <Button
              label="Avbryt"
              variant="ghost"
              onPress={() => setMovingId(null)}
            />
          </View>
        ) : null}

        {locked ? null : isConfirming ? (
          <View style={styles.actions}>
            <Text style={styles.confirmText}>Ta bort «{song.title}»?</Text>
            <Button
              label="Avbryt"
              variant="ghost"
              onPress={() => setConfirmDeleteId(null)}
            />
            <Button
              label="Ta bort"
              variant="danger"
              onPress={() => {
                deleteSong(song.id);
                setConfirmDeleteId(null);
              }}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            <Button
              label="Ändra"
              onPress={() => {
                loadSong(song.id);
                onOpenPlay();
              }}
            />
            <Button
              label="Flytta"
              variant="ghost"
              onPress={() => {
                setMovingId(isMoving ? null : song.id);
                setEditingId(null);
              }}
            />
            <Button
              label="Byt namn"
              variant="ghost"
              onPress={() => beginRename(song.id, song.title)}
            />
            <Button
              label="Ta bort"
              variant="danger"
              onPress={() => setConfirmDeleteId(song.id)}
            />
          </View>
        )}
      </Card>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {locked ? (
        <Card>
          <Text style={styles.help}>
            Appen är låst i konsertläge: bara uppspelning är möjlig. Lås upp
            genom att dra låset längst ner åt höger.
          </Text>
        </Card>
      ) : null}

      {songs.length > 0 ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Sök bland låtarna"
          placeholderTextColor={t.textMuted}
          style={styles.search}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      ) : null}

      {searching ? (
        <Text style={styles.searchInfo}>
          {matches.length === 0
            ? `Ingen låt matchar «${query.trim()}».`
            : `${matches.length} ${matches.length === 1 ? 'träff' : 'träffar'} på «${query.trim()}».`}
        </Text>
      ) : null}

      {songs.length === 0 ? (
        <Card>
          <Text style={styles.help}>
            Inga låtar sparade än. Ställ in tempo och toner i spelvyn och lägg
            till låten här.
          </Text>
        </Card>
      ) : null}

      {folders.map((folder) => {
        const inFolder = matches.filter((song) => song.folderId === folder.id);
        // Under sökning fälls mappar med träffar upp, annars göms svaret.
        const open = searching ? inFolder.length > 0 : !collapsed.includes(folder.id);
        const isEditingFolder = editingFolderId === folder.id;
        const isConfirmingFolder = confirmDeleteFolderId === folder.id;

        if (searching && inFolder.length === 0) {
          return null;
        }

        return (
          <View key={folder.id} style={styles.folder}>
            {isEditingFolder ? (
              <View style={styles.editRow}>
                <TextInput
                  value={draftFolderName}
                  onChangeText={setDraftFolderName}
                  style={[styles.input, styles.editInput]}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    renameFolder(folder.id, draftFolderName);
                    setEditingFolderId(null);
                  }}
                />
                <Button
                  label="Klart"
                  variant="primary"
                  onPress={() => {
                    renameFolder(folder.id, draftFolderName);
                    setEditingFolderId(null);
                  }}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => toggleFolder(folder.id)}
                style={styles.folderHeader}
              >
                <Text style={styles.folderName}>
                  {open ? '▾' : '▸'}  {folder.name}
                </Text>
                <Text style={styles.folderCount}>
                  {inFolder.length} {inFolder.length === 1 ? 'låt' : 'låtar'}
                </Text>
              </Pressable>
            )}

            {locked ? null : isConfirmingFolder ? (
              <View style={styles.actions}>
                <Text style={styles.confirmText}>
                  Ta bort mappen «{folder.name}»? Låtarna blir kvar.
                </Text>
                <Button
                  label="Avbryt"
                  variant="ghost"
                  onPress={() => setConfirmDeleteFolderId(null)}
                />
                <Button
                  label="Ta bort mapp"
                  variant="danger"
                  onPress={() => {
                    deleteFolder(folder.id);
                    setConfirmDeleteFolderId(null);
                  }}
                />
              </View>
            ) : (
              <View style={styles.folderActions}>
                <Button
                  label="Byt namn"
                  variant="ghost"
                  onPress={() => {
                    setEditingFolderId(folder.id);
                    setDraftFolderName(folder.name);
                  }}
                />
                <Button
                  label="Ta bort mapp"
                  variant="ghost"
                  onPress={() => setConfirmDeleteFolderId(folder.id)}
                />
              </View>
            )}

            {open ? (
              <View style={styles.folderBody}>
                {inFolder.length === 0 ? (
                  <Text style={styles.help}>
                    Mappen är tom. Använd «Flytta» på en låt för att lägga den här.
                  </Text>
                ) : (
                  inFolder.map((song) => renderSong(song, inFolder))
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      {loose.length > 0 || (!searching && folders.length > 0) ? (
        <SectionTitle>
          {folders.length > 0 ? `Utanför mappar (${loose.length})` : `Sparade låtar (${loose.length})`}
        </SectionTitle>
      ) : null}

      {loose.map((song) => renderSong(song, loose))}

      {/* Mappskapandet ligger under låtarna: det används sällan och ska inte
          stå i vägen för listan man faktiskt kom för. Göms i låst läge. */}
      {locked ? null : (
        <Card>
          <SectionTitle>Ny mapp</SectionTitle>
          <View style={styles.editRow}>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Namn på mappen"
              placeholderTextColor={t.textMuted}
              style={[styles.input, styles.editInput]}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (newFolderName.trim()) {
                  addFolder(newFolderName);
                  setNewFolderName('');
                }
              }}
            />
            <Button
              label="Skapa"
              disabled={!newFolderName.trim()}
              onPress={() => {
                addFolder(newFolderName);
                setNewFolderName('');
              }}
            />
          </View>
        </Card>
      )}

      {/* Samma draggest åt båda hållen: in i konsertläget och ut ur det. */}
      {!locked && songs.length > 0 ? (
        <Card>
          <SectionTitle>Konsertläge</SectionTitle>
          <Text style={styles.help}>
            Låser appen till uppspelning: inga låtar eller inställningar går
            att ändra, och bara listan visas. Bra när telefonen ligger framme
            på notstället.
          </Text>
          <View style={styles.lockRow}>
            <SlideToConfirm
              hint="Dra låset åt höger för att låsa"
              onConfirm={onLock ?? (() => {})}
            />
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  help: {
    color: t.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  // Dragbanan fyller radens bredd — utan raden runt om har flex ingen riktning.
  lockRow: {
    flexDirection: 'row',
  },
  /**
   * Taktvisaren tar all plats som blir över mellan titeln och tempoknappen,
   * så att den hamnar så nära radens mitt som innehållet tillåter.
   */
  headerMetronome: {
    flex: 1,
    minWidth: 120,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Texten tar sin naturliga bredd men får krympa när titeln är lång.
  headerText: {
    flexShrink: 1,
  },
  /**
   * Tempot i rubriken: bara så stort som texten kräver. Det växer inte med
   * raden, eftersom överflödet hör till taktvisaren bredvid.
   */
  headerTempo: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  /** Greppet: liten yta, men hög nog att träffa med tummen. */
  grip: {
    paddingVertical: 6,
    paddingRight: 2,
  },
  // Det dragna kortet lyfts ur listan så att man ser vad man håller i.
  draggingCard: {
    opacity: 0.92,
    borderColor: t.accent,
    elevation: 8,
    zIndex: 20,
  },
  input: {
    backgroundColor: t.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.border,
    color: t.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  search: {
    backgroundColor: t.surfaceRaised,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
    color: t.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  searchInfo: {
    color: t.textMuted,
    fontSize: 12,
    marginTop: -spacing.xs,
  },
  editRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
  },
  folder: {
    backgroundColor: t.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  folderName: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  folderCount: {
    color: t.textMuted,
    fontSize: 12,
  },
  folderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  folderBody: {
    gap: spacing.sm,
  },
  // Den valda låtens ruta lyser med accentram och tonad botten — samma
  // markering vare sig den valdes med ett tryck eller genom att tempot
  // startades.
  currentCard: {
    borderColor: t.accent,
    backgroundColor: t.accentSurface,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: t.text,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  meta: {
    color: t.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  tones: {
    color: t.pure,
    fontSize: 13,
    marginTop: 4,
  },
  tonesEmpty: {
    color: t.textMuted,
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  quickButton: {
    flexGrow: 1,
    flexBasis: 84,
    paddingHorizontal: 6,
    paddingVertical: 11,
  },
  moveBox: {
    backgroundColor: t.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  moveLabel: {
    color: t.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  chipOn: {
    backgroundColor: t.accent,
    borderColor: t.accent,
  },
  chipText: {
    color: t.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextOn: {
    color: t.onAccent,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  confirmText: {
    color: t.text,
    fontSize: 13,
    flex: 1,
  },
});
