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
  Dimensions,
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
/**
 * Apples standardsymbol för omflyttning: tre vågräta streck, som i
 * Påminnelser och alla andra iOS-listor som går att ordna om.
 */
function GripIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      {[7, 13, 19].map((y) => (
        <Line
          key={y}
          x1={4}
          y1={y}
          x2={22}
          y2={y}
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

/**
 * Apples standardsymbol för att redigera: en penna som skriver på ett
 * papper — samma bild som «square.and.pencil» i iOS egna appar. Papperet
 * lämnar en öppning uppe till höger där pennan går in.
 */
function PencilIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M20 13 V18.5 A2.5 2.5 0 0 1 17.5 21 H5.5 A2.5 2.5 0 0 1 3 18.5 V6.5 A2.5 2.5 0 0 1 5.5 4 H11"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M20.9 3.1a2 2 0 0 0-2.83 0l-7.4 7.4a1 1 0 0 0-.26.45l-.9 3.3a.55.55 0 0 0 .68.68l3.3-.9a1 1 0 0 0 .45-.26l7.4-7.4a2 2 0 0 0 0-2.83z"
        fill={color}
      />
    </Svg>
  );
}

/** Soptunna: lock med handtag, kropp och tre ränder. */
function TrashIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Line
        x1={4.5}
        y1={6.3}
        x2={19.5}
        y2={6.3}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M9.5 6 V4.8 c0-.7 .6-1.3 1.3-1.3 h2.4 c.7 0 1.3 .6 1.3 1.3 V6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M6.3 6.5 l.9 12.9 a2 2 0 0 0 2 1.86 h5.6 a2 2 0 0 0 2-1.86 l.9-12.9"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      {[9.7, 12, 14.3].map((x) => (
        <Line
          key={x}
          x1={x}
          y1={9.8}
          x2={x}
          y2={17.3}
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
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
  const scrollRef = useRef<ScrollView>(null);
  /** Rullningsläget, för att kunna räkna om skärmlägen till innehållslägen. */
  const scrollOffset = useRef(0);

  /**
   * Skapar mappen och rullar dit. Mapparna sorteras i bokstavsordning, så den
   * nya kan hamna var som helst i listan — långt från skaparkortet längst ner.
   * Utan rullningen ser det ut som att ingenting hände.
   */
  const skapaMapp = () => {
    if (!newFolderName.trim()) {
      return;
    }
    const mapp = addFolder(newFolderName);
    setNewFolderName('');
    // Vänta tills listan ritats om med den nya mappen; först då finns dess
    // vy att mäta på. Mappens ruta är också dess släppzon, så refen finns.
    setTimeout(() => {
      zoneRefs.current.get(mapp.id)?.measureInWindow((_x, y) => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollOffset.current + y - 90),
          animated: true,
        });
      });
    }, 120);
  };
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
  /** Mellanrummet mellan korten i gruppen — bytena flyttar kortet höjd + glapp. */
  const dragMellanrum = useRef(0);
  /** Rullningsläget när greppet togs, så att autoscrollen kan räknas bort. */
  const dragScrollStart = useRef(0);
  /** Fingrets senaste läge, läst av autoscrollen mellan rörelserna. */
  const fingerDy = useRef(0);
  const fingerMoveY = useRef(0);
  /** Låten som dras just nu — refvarianten, läst inifrån autoscrollen. */
  const draggingRef = useRef<string | null>(null);
  const autoScrollFrame = useRef<number | null>(null);
  /** Listans mått, för att kunna stanna autoscrollen vid ändarna. */
  const viewportH = useRef(0);
  const contentH = useRef(0);
  /** Varje låts grannar, uppdaterad vid utritningen och läst vid greppet. */
  const groupIds = useRef(new Map<string, string[]>());
  /** Vilken mapp varje låt ligger i, läst när greppet släpps. */
  const groupFolder = useRef(new Map<string, string | null>());

  /**
   * Släppzoner: varje mapp och området utanför mapparna.
   *
   * Zonernas lägen mäts när greppet tas, och fingrets läge jämförs mot dem
   * under dragningen. Släpper man över en annan mapp flyttas låten dit.
   */
  const LÖST = '__utanför__';
  const zoneRefs = useRef(new Map<string, View | null>());
  const zoneBounds = useRef(new Map<string, { top: number; bottom: number }>());
  /** Mappen fingret svävar över, för att kunna lysa upp den. */
  const [hoverZone, setHoverZone] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);

  /** Mappen under fingret, eller LÖST för området utanför mapparna. */
  const zonUnder = (y: number): string | null => {
    for (const [id, { top, bottom }] of zoneBounds.current) {
      if (y >= top && y <= bottom) {
        return id;
      }
    }
    return null;
  };
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

  /**
   * Räknar om kortets läge efter en fingerrörelse eller en autoscroll.
   *
   * Kortet skall alltid ligga kvar under fingret — det är iOS-standarden och
   * det enda som känns rätt. Fingrets väg genom innehållet är dy plus det
   * listan hunnit rulla sedan greppet, och varje passerad granne räknas bort
   * med grannens höjd plus mellanrummet, så att förskjutningen inte driver.
   */
  const uppdateraDrag = (songId: string) => {
    const rullat = scrollOffset.current - dragScrollStart.current;
    const rel = fingerDy.current + rullat;

    // Bytet sker när fingret passerat halva grannen — samma tröskel åt båda
    // håll, så att kortet inte fastnar mellan två lägen. En snabb autoscroll
    // kan passera flera grannar mellan två uppdateringar, därav rundan.
    // Tröskeln måste vara halva steget ett byte flyttar räkningen, höjd och
    // mellanrum tillsammans — annars kan läget efter ett byte ligga över
    // tröskeln åt andra hållet, och rundan byter fram och tillbaka för evigt.
    // Taket är en säkerhetslina: fler byten än gruppen har medlemmar kan
    // aldrig behövas, så en räknemiss kan på sin höjd lämna kortet snett —
    // inte frysa appen.
    let plats = dragGroup.current.indexOf(songId);
    for (let varv = 0; varv < dragGroup.current.length; varv++) {
      const kvar = rel - dragCommitted.current;
      const granne =
        kvar > 0 ? dragGroup.current[plats + 1] : dragGroup.current[plats - 1];
      const höjd = granne ? grannHöjd(granne) : 0;
      if (
        !granne ||
        höjd <= 0 ||
        Math.abs(kvar) <= (höjd + dragMellanrum.current) / 2
      ) {
        break;
      }
      const riktning: -1 | 1 = kvar > 0 ? 1 : -1;
      moveSongInFolder(songId, riktning);
      const ny = [...dragGroup.current];
      [ny[plats], ny[plats + riktning]] = [ny[plats + riktning], ny[plats]];
      dragGroup.current = ny;
      dragCommitted.current += riktning * (höjd + dragMellanrum.current);
      plats += riktning;
    }
    setDragOffset(rel - dragCommitted.current);

    // Vilken mapp svävar fingret över? Zonerna mättes vid greppet, så det
    // rullade läggs till för att jämföra i samma koordinater. Bara byten
    // ritas om, annars skulle varje rörelse kosta en omritning i onödan.
    const zon = zonUnder(fingerMoveY.current + rullat);
    if (zon !== hoverRef.current) {
      hoverRef.current = zon;
      setHoverZone(zon);
    }
  };

  /**
   * Autoscroll under dragning: när fingret närmar sig skärmens kant rullar
   * listan åt det hållet, fortare ju närmare kanten fingret är. Utan den går
   * det inte att dra en låt till en mapp utanför skärmen, eftersom listans
   * egen rullning är avstängd medan ett kort hålls i.
   */
  const KANT = 130;
  const MAX_FART = 14;
  const autoScrolla = (songId: string) => {
    autoScrollFrame.current = requestAnimationFrame(() => {
      if (draggingRef.current !== songId) {
        return;
      }
      const y = fingerMoveY.current;
      const skärm = Dimensions.get('window').height;
      let fart = 0;
      if (y > 0 && y < KANT) {
        fart = (-MAX_FART * (KANT - y)) / KANT;
      } else if (y > skärm - KANT) {
        fart = (MAX_FART * (y - (skärm - KANT))) / KANT;
      }
      if (fart !== 0) {
        const max = Math.max(0, contentH.current - viewportH.current);
        const ny = Math.min(max, Math.max(0, scrollOffset.current + fart));
        if (ny !== scrollOffset.current) {
          scrollOffset.current = ny;
          scrollRef.current?.scrollTo({ y: ny, animated: false });
          uppdateraDrag(songId);
        }
      }
      autoScrolla(songId);
    });
  };

  /** Städar efter greppet, vare sig det släpptes eller togs ifrån oss. */
  const avslutaDrag = () => {
    if (autoScrollFrame.current !== null) {
      cancelAnimationFrame(autoScrollFrame.current);
      autoScrollFrame.current = null;
    }
    draggingRef.current = null;
    hoverRef.current = null;
    setHoverZone(null);
    setDraggingId(null);
    setDragOffset(0);
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
      onPanResponderGrant: (event) => {
        const group = groupIds.current.get(songId) ?? [];
        // Mät hela gruppen nu: höjderna kan ha ändrats sedan sist, och de
        // behövs redan vid första rörelsen.
        group.forEach((id) =>
          cardRefs.current
            .get(id)
            ?.measureInWindow((_x, _y, _w, h) => heights.current.set(id, h)),
        );
        // Mät släppzonerna: var mapparna ligger på skärmen just nu.
        zoneBounds.current.clear();
        zoneRefs.current.forEach((vy, id) =>
          vy?.measureInWindow((_x, y, _w, h) =>
            zoneBounds.current.set(id, { top: y, bottom: y + h }),
          ),
        );
        dragGroup.current = group;
        dragCommitted.current = 0;
        // Mellanrummet mellan grannarna: mappkroppen packar tätare än ytan
        // utanför mapparna. Måtten kommer ur samma stilar som ritar listan.
        dragMellanrum.current =
          (groupFolder.current.get(songId) ?? null) !== null
            ? spacing.sm
            : spacing.md;
        dragScrollStart.current = scrollOffset.current;
        fingerDy.current = 0;
        fingerMoveY.current = event.nativeEvent.pageY;
        hoverRef.current = null;
        setHoverZone(null);
        setDragOffset(0);
        setDraggingId(songId);
        draggingRef.current = songId;
        autoScrolla(songId);
      },
      onPanResponderMove: (_event, gesture) => {
        fingerDy.current = gesture.dy;
        fingerMoveY.current = gesture.moveY;
        uppdateraDrag(songId);
      },
      onPanResponderRelease: () => {
        // Släpp över en annan mapp flyttar låten dit. Samma mapp betyder att
        // dragningen bara ordnade om, och då är den redan gjord.
        const zon = hoverRef.current;
        if (zon !== null) {
          const mål = zon === LÖST ? null : zon;
          const nuvarande = groupFolder.current.get(songId) ?? null;
          if (mål !== nuvarande) {
            moveSongToFolder(songId, mål);
          }
        }
        avslutaDrag();
      },
      onPanResponderTerminate: () => {
        avslutaDrag();
      },
    });
    responders.current.set(songId, responder);
    return responder;
  };
  /**
   * Svep åt vänster på ett kort: kortet glider åt sidan och avslöjar «Byt
   * namn» och «Ta bort» — som i iOS egna listor. Ett kort i taget kan stå
   * öppet; ett tryck var som helst på kortet stänger det igen.
   */
  const SVEPBREDD = 88;
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const swipedRef = useRef<string | null>(null);
  /** Kortet som sveps just nu och hur långt det har glidit. */
  const [sveparId, setSveparId] = useState<string | null>(null);
  const [svepDx, setSvepDx] = useState(0);
  const svepBas = useRef(0);
  const svepResponders = useRef(
    new Map<string, ReturnType<typeof PanResponder.create>>(),
  );

  const stängSvep = () => {
    swipedRef.current = null;
    setSwipedId(null);
  };

  const svepResponderFor = (songId: string) => {
    const redan = svepResponders.current.get(songId);
    if (redan) {
      return redan;
    }
    const responder = PanResponder.create({
      // Bara tydligt vågräta rörelser tas: lodräta tillhör listans rullning
      // och stillastående tryck tillhör kortets knappar.
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 10 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        svepBas.current = swipedRef.current === songId ? -SVEPBREDD : 0;
        setSvepDx(svepBas.current);
        setSveparId(songId);
        // Ett annat öppet kort stängs så fort ett nytt grepp tas.
        if (swipedRef.current !== null && swipedRef.current !== songId) {
          stängSvep();
        }
      },
      onPanResponderMove: (_event, gesture) => {
        const dx = Math.min(0, Math.max(-SVEPBREDD, svepBas.current + gesture.dx));
        setSvepDx(dx);
      },
      onPanResponderRelease: (_event, gesture) => {
        const dx = svepBas.current + gesture.dx;
        if (dx < -SVEPBREDD / 2) {
          swipedRef.current = songId;
          setSwipedId(songId);
        } else if (swipedRef.current === songId) {
          stängSvep();
        }
        setSveparId(null);
      },
      onPanResponderTerminate: () => {
        setSveparId(null);
      },
    });
    svepResponders.current.set(songId, responder);
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
      setConfirmDeleteId(null);
      setEditingFolderId(null);
      setConfirmDeleteFolderId(null);
      stängSvep();
    }
  }, [locked]);

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
    const isConfirming = confirmDeleteId === song.id;
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
      /**
       * 30 % mindre än i spelvyn, och upplyft: skalan ritar visaren i 70 %
       * storlek, omslaget krymper platsen i samma mån, och minusmarginalen
       * låter den sticka upp ovanför knappraden — i x-led står den kvar
       * över tempoknappen, i y-led hamnar den till höger om rubriken.
       */
      <View style={styles.taktvisareLyft}>
        <View style={styles.taktvisareSkala}>
          <MetronomeVisual
            style={settings.metronomeVisual}
            running={isExpanded || isPlayingTempo}
            bpm={song.bpm}
            pulse={isPlayingTempo ? pulse : null}
            activeBeat={isPlayingTempo && pulse ? pulse.beat : null}
            silent={!isPlayingTempo}
            // 80 % bredare än standardstrecket: spalten är smal och bollen
            // behöver något att landa på i ögats mening.
            groundWidth="88%"
          />
        </View>
      </View>
    );

    /** Pennan på papperet — Apples redigeringssymbol — öppnar spelvyn. */
    const ändraKnapp = (
      <Pressable
        onPress={() => {
          loadSong(song.id);
          onOpenPlay();
        }}
        hitSlop={10}
        style={styles.editCorner}
      >
        <PencilIcon color={t.textMuted} />
      </Pressable>
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
    // Dragningen ordnar om inom gruppen och flyttar mellan mappar. Den senare
    // är meningsfull även för en ensam låt, så länge det finns en mapp att dra
    // till. I konsertläget går ingetdera.
    const kanDras = !locked && (grupp.length > 1 || folders.length > 0);
    // Grannarna läses ur refen när greppet tas, så att respondern slipper
    // skapas om varje gång listan ritas.
    groupIds.current.set(song.id, grupp.map((s) => s.id));
    groupFolder.current.set(song.id, song.folderId);

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

    const kanSvepas = !locked;
    const svepX =
      sveparId === song.id ? svepDx : swipedId === song.id ? -SVEPBREDD : 0;

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
        style={styles.swipeWrap}
      >
      {/* Åtgärden ligger bakom kortet och syns när det glider åt sidan.
          Namn byts i redigeringsvyn, så svepet rymmer bara borttagningen:
          en rund soptunna som sakta växer sig fullstor ju längre man drar. */}
      {kanSvepas && (sveparId === song.id || svepX !== 0) ? (
        <View style={styles.swipeActions}>
          <Pressable
            style={[
              styles.swipeDelete,
              {
                transform: [
                  { scale: 0.3 + 0.7 * Math.min(1, -svepX / SVEPBREDD) },
                ],
              },
            ]}
            onPress={() => {
              stängSvep();
              setConfirmDeleteId(song.id);
            }}
          >
            <TrashIcon color={t.onAccent} />
          </Pressable>
        </View>
      ) : null}
      <View
        style={svepX !== 0 ? { transform: [{ translateX: svepX }] } : undefined}
        {...(kanSvepas ? svepResponderFor(song.id).panHandlers : {})}
      >
      <Card
        // Den valda låten får accentramen — samma ram som när metronomen går.
        // Den dragna lyfts ur listan så att man ser vad man håller i.
        style={[
          isCurrent ? styles.currentCard : undefined,
          isDragging
            ? {
                ...styles.draggingCard,
                transform: [{ translateY: dragOffset }, { scale: 1.02 }],
              }
            : undefined,
        ].reduce((a, b) => ({ ...a, ...b }), {})}
        // Ett tryck var som helst i rutan väljer låten och fäller upp pianot.
        // Trycket fäller aldrig ihop igen — den uppfällda rutan är full av
        // knappar och tangenter, och ett tryck bredvid dem skulle rycka undan
        // det man siktade på. Rutan stängs först när en annan låt väljs.
        // Står ett kort öppet efter ett svep stänger trycket bara det.
        onPress={() => {
          if (swipedRef.current !== null) {
            stängSvep();
            return;
          }
          loadSong(song.id);
          setExpandedId(song.id);
        }}
      >
        {/*
          * Rubriken och underrubrikerna ligger överst på hela bredden, i
          * båda lägena. Uppfälld följer taktvisaren på raden under;
          * hopfälld står den lilla taktvisaren i rubrikraden.
          */}
        {(
          <View>
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
              {/* Pennan uppe i högra hörnet öppnar redigeringen — Apples
                  egen symbol i stället för en Ändra-knapp. */}
              {locked ? null : ändraKnapp}
            </View>
            {underrubriker}
          </View>
        )}

        {/* Samma tre knappar i båda lägena. Uppfälld står taktvisaren rakt
            ovanför tempoknappen — de hör ihop: knappen sätter igång det
            visaren visar. Raden bottenjusteras så att knapparna ligger i
            linje fast tempospalten är högre. */}
        <View
          style={[
            styles.quickRow,
            isExpanded ? styles.quickRowExpanded : undefined,
          ]}
        >
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
              och metronomen är det enda som fortsätter låta efter trycket. */}
          {isExpanded ? (
            <View style={styles.tempoColumn}>
              <View style={styles.headerMetronome}>{taktvisare}</View>
              {tempoKnapp(styles.tempoColumnButton)}
            </View>
          ) : (
            tempoKnapp(styles.quickButton)
          )}
        </View>

        {/* Uppfällt kort: ett piano där bara låtens toner går att spela, i
            låtens egen stämning. Ren uppspelning — inget går att ändra
            härifrån. Med plats står taktvisaren till höger om klaviaturen. */}
        {isExpanded ? klaviatur : null}

        {/* Byt namn och Ta bort nås med ett svep åt vänster på kortet, som i
            iOS egna listor. Flytt sker genom att dra kortet i greppet och
            redigeringen bakom pennan uppe i hörnet. */}
        {locked || !isConfirming ? null : (
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
        )}
      </Card>
      </View>
      </View>
    );
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      // Medan ett kort hålls i får listan inte panorera med fingret — det
      // drog innehållet åt fel håll under kortet. Rullning under dragning
      // sköts i stället av autoscrollen vid skärmkanterna.
      scrollEnabled={draggingId === null}
      onScroll={(e) => {
        scrollOffset.current = e.nativeEvent.contentOffset.y;
      }}
      onLayout={(e) => {
        viewportH.current = e.nativeEvent.layout.height;
      }}
      onContentSizeChange={(_w, h) => {
        contentH.current = h;
      }}
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

        // Svepets läge för mappens rubrikrad — samma maskineri som låtarna.
        const mappSvepX =
          sveparId === folder.id
            ? svepDx
            : swipedId === folder.id
              ? -SVEPBREDD
              : 0;
        // Antalet räknas på hela biblioteket, inte på sökträffarna: varningen
        // skall tala om vad mappen faktiskt rymmer.
        const antalIMappen = songs.filter(
          (s) => s.folderId === folder.id,
        ).length;

        return (
          /* Mappen är också en släppzon: drar man en låt hit hamnar den i
             mappen. Ramen lyser upp medan fingret svävar över. */
          <View
            key={folder.id}
            ref={(el) => {
              zoneRefs.current.set(folder.id, el);
            }}
            style={[
              styles.folder,
              hoverZone === folder.id ? styles.folderHover : undefined,
            ]}
          >
            {/* Rubrikraden sveps åt vänster för att ta bort mappen, precis
                som låtkorten: en rund soptunna växer fram bakom raden. */}
            <View style={styles.swipeWrap}>
              {!locked && (sveparId === folder.id || mappSvepX !== 0) ? (
                <View style={styles.swipeActions}>
                  <Pressable
                    style={[
                      styles.swipeDelete,
                      styles.swipeDeleteFolder,
                      {
                        transform: [
                          {
                            scale:
                              0.3 + 0.7 * Math.min(1, -mappSvepX / SVEPBREDD),
                          },
                        ],
                      },
                    ]}
                    onPress={() => {
                      stängSvep();
                      // En tom mapp försvinner direkt. Innehåller den låtar
                      // ställs varningsfrågan — och är de många krävs draget.
                      if (antalIMappen === 0) {
                        deleteFolder(folder.id);
                      } else {
                        setConfirmDeleteFolderId(folder.id);
                      }
                    }}
                  >
                    <TrashIcon color={t.onAccent} />
                  </Pressable>
                </View>
              ) : null}
              <View
                style={
                  mappSvepX !== 0
                    ? { transform: [{ translateX: mappSvepX }] }
                    : undefined
                }
                {...(locked ? {} : svepResponderFor(folder.id).panHandlers)}
              >
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
                    onPress={() => {
                      if (swipedRef.current !== null) {
                        stängSvep();
                        return;
                      }
                      toggleFolder(folder.id);
                    }}
                    style={styles.folderHeader}
                  >
                    <Text style={styles.folderName}>
                      {open ? '▾' : '▸'}  {folder.name}
                    </Text>
                    <Text style={styles.folderCount}>
                      {inFolder.length} {inFolder.length === 1 ? 'låt' : 'låtar'}
                    </Text>
                    {/* Pennan byter namn — samma symbol som på låtkorten. */}
                    {locked ? null : (
                      <Pressable
                        onPress={() => {
                          setEditingFolderId(folder.id);
                          setDraftFolderName(folder.name);
                        }}
                        hitSlop={10}
                        style={styles.editCorner}
                      >
                        <PencilIcon color={t.textMuted} />
                      </Pressable>
                    )}
                  </Pressable>
                )}
              </View>
            </View>

            {locked || !isConfirmingFolder ? null : antalIMappen > 5 ? (
              /* Många låtar: ett tryck räcker inte, borttagningen bekräftas
                 med samma draggest som konsertläget. Låtarna blir kvar. */
              <View style={styles.folderConfirmSlide}>
                <Text style={styles.confirmText}>
                  Mappen «{folder.name}» innehåller {antalIMappen} låtar.
                  Låtarna blir kvar, men mappen försvinner.
                </Text>
                <SlideToConfirm
                  hint="Dra för att ta bort mappen"
                  onConfirm={() => {
                    deleteFolder(folder.id);
                    setConfirmDeleteFolderId(null);
                  }}
                />
                <Button
                  label="Avbryt"
                  variant="ghost"
                  onPress={() => setConfirmDeleteFolderId(null)}
                />
              </View>
            ) : (
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
            )}

            {open ? (
              <View style={styles.folderBody}>
                {inFolder.length === 0 ? (
                  <Text style={styles.help}>
                    Mappen är tom. Dra hit en låt i dess grepp.
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

      {/* Området utanför mapparna är också en släppzon: drar man en låt hit
          lämnar den sin mapp. */}
      <View
        ref={(el) => {
          zoneRefs.current.set(LÖST, el);
        }}
        style={[
          styles.looseZone,
          hoverZone === LÖST ? styles.folderHover : undefined,
        ]}
      >
        {loose.map((song) => renderSong(song, loose))}
        {loose.length === 0 && folders.length > 0 ? (
          <Text style={styles.help}>
            Alla låtar ligger i mappar. Dra en hit för att ta ut den.
          </Text>
        ) : null}
      </View>

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
              onSubmitEditing={skapaMapp}
            />
            <Button
              label="Skapa"
              disabled={!newFolderName.trim()}
              onPress={skapaMapp}
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
  // Taktvisaren fyller spaltens bredd, så att pendeln svänger mitt över
  // tempoknappen under den.
  headerMetronome: {
    alignSelf: 'stretch',
  },
  /**
   * Visarens plats i flödet: 70 % av full höjd (150 → 105) och upplyft med
   * minusmarginalen så att den ritas bredvid rubriken och undertexterna i
   * stället för att trycka ner knappraden.
   */
  taktvisareLyft: {
    height: 105,
    marginTop: -64,
    justifyContent: 'center',
  },
  // Skalningen ritar hela visaren mindre; minusmarginalerna tar bort
  // skillnaden mellan full och skalad höjd ur flödet (150 → 105).
  taktvisareSkala: {
    height: 150,
    marginTop: -22.5,
    marginBottom: -22.5,
    transform: [{ scale: 0.7 }],
  },
  // Knapparna ligger kvar i linje längst ner fast tempospalten är högre.
  quickRowExpanded: {
    alignItems: 'flex-end',
  },
  /**
   * Tempospalten tar samma plats i raden som tempoknappen gör hopfälld,
   * med taktvisaren staplad rakt ovanför knappen.
   */
  tempoColumn: {
    flexGrow: 1,
    flexBasis: 84,
    gap: spacing.xs,
  },
  tempoColumnButton: {
    alignSelf: 'stretch',
    paddingHorizontal: 6,
    paddingVertical: 11,
  },
  /** Greppet: liten yta, men hög nog att träffa med tummen. */
  grip: {
    paddingVertical: 6,
    paddingRight: 2,
  },
  // Det dragna kortet lyfts ur listan så att man ser vad man håller i.
  // Det dragna kortet lyfts som i iOS: lite större, med skugga under sig.
  draggingCard: {
    opacity: 0.95,
    borderColor: t.accent,
    elevation: 8,
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
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
  // Rubrikraden är lägre än ett låtkort, så mappens soptunna är mindre.
  swipeDeleteFolder: {
    width: 40,
    height: 40,
  },
  // Dra-bekräftelsen behöver hela bredden, så den står i egen spalt.
  folderConfirmSlide: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  // Zonen utanför mapparna behöver egen höjd även när den är tom, annars
  // finns ingen yta att släppa på när allt ligger i mappar. Ramen är osynlig
  // tills fingret svävar över zonen — den finns där hela tiden för att
  // markeringen inte skall ändra layouten och rycka i kortet som dras.
  looseZone: {
    gap: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.md,
  },
  /**
   * Släppzonen under fingret: samma accentram som en vald låt. Bara färgerna
   * får skilja sig från vilozonens stil — en tjockare ram skulle flytta allt
   * under den och få det dragna kortet att hoppa.
   */
  folderHover: {
    borderColor: t.accent,
    backgroundColor: t.accentSurface,
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
  /**
   * Svepets tre lager: omslaget håller måttet, åtgärderna ligger i botten
   * och kortet glider ovanpå. Åtgärderna fyller kortets hela höjd så att
   * träffytan är lika generös som i iOS egna listor.
   */
  swipeWrap: {
    position: 'relative',
  },
  swipeActions: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Helt rund soptunna. Skalan sätts vid utritningen och följer svepet.
  swipeDelete: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: t.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  // Pennan står överst i kortets högra hörn, i linje med rubriken.
  editCorner: {
    alignSelf: 'flex-start',
    padding: 2,
  },
  confirmText: {
    color: t.text,
    fontSize: 13,
    flex: 1,
  },
});
