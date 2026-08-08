/**
 * Färgteman.
 *
 * Varje tema anger bara ett tjugotal grundfärger. Resten härleds — textfärgen
 * ovanpå färgade plattor, klaviaturens nyanser, grundtonsmarkeringen — så att ett
 * nytt tema inte behöver räkna fram tjugofem värden för hand, och så att
 * nyanserna hänger ihop inom temat i stället för att vara lösryckta.
 *
 * Appen används ofta i dunkla kyrkor och salar, därför är fyra av de sju
 * mörka. De ljusa finns för repetitioner i dagsljus.
 */

export type ThemeId =
  | 'konsertsal'
  | 'katedral'
  | 'sammet'
  | 'nocturne'
  | 'notblad'
  | 'flygel'
  | 'pergament';

/** Grundfärgerna ett tema måste ange. Allt annat räknas fram ur dessa. */
interface ThemeCore {
  label: string;
  description: string;
  /** Styr statusradens textfärg och hur nyanser vägs vid härledningen. */
  dark: boolean;

  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;

  /** Tempo och metronom. */
  accent: string;
  /** Ren stämning och grundton. */
  pure: string;
  /** Sparade körtoner. */
  tone: string;
  danger: string;

  keyWhite: string;
  keyBlack: string;
}

const CORES: Record<ThemeId, ThemeCore> = {
  konsertsal: {
    label: 'Konsertsal',
    description: 'Mörkt och lågmält, avläsbart på en armlängds avstånd i dunkel sal.',
    dark: true,
    background: '#101018',
    surface: '#1c1c28',
    surfaceRaised: '#262635',
    border: '#33334a',
    text: '#f4f4f8',
    textMuted: '#9a9ab0',
    accent: '#f2a65a',
    pure: '#5ee0b0',
    tone: '#7aa2f7',
    danger: '#f0616d',
    keyWhite: '#f4f4f8',
    keyBlack: '#22222e',
  },

  katedral: {
    label: 'Katedral',
    description: 'Djupblått och guld, som kvällsljus genom ett glasfönster.',
    dark: true,
    background: '#0d1224',
    surface: '#161d36',
    surfaceRaised: '#202949',
    border: '#2d3961',
    text: '#eef1fa',
    textMuted: '#97a1c4',
    accent: '#d8b25c',
    pure: '#5fbf9e',
    tone: '#7f9fe0',
    danger: '#e06a72',
    keyWhite: '#eef1fa',
    keyBlack: '#1a2340',
  },

  sammet: {
    label: 'Sammet',
    description: 'Vinrött och gammelguld, som ridån i en operasalong.',
    dark: true,
    background: '#1a0f14',
    surface: '#291821',
    surfaceRaised: '#37212c',
    border: '#4a2f3c',
    text: '#f6ecef',
    textMuted: '#b99aa5',
    accent: '#d9a441',
    pure: '#6fbf9b',
    tone: '#c98fa6',
    danger: '#e2606a',
    keyWhite: '#f6ecef',
    keyBlack: '#2b1a22',
  },

  nocturne: {
    label: 'Nocturne',
    description: 'Svalt blågrått med silverblå ton. Vilsamt för ögat sent på kvällen.',
    dark: true,
    background: '#10141c',
    surface: '#1a212d',
    surfaceRaised: '#242d3d',
    border: '#334054',
    text: '#eef2f8',
    textMuted: '#97a4b8',
    accent: '#8fb6e8',
    pure: '#6ecfb0',
    tone: '#b0a7e0',
    danger: '#e2717a',
    keyWhite: '#eef2f8',
    keyBlack: '#1d2530',
  },

  notblad: {
    label: 'Notblad',
    description: 'Ljust notpapper med bläckrött. Ljust nog för repetition i dagsljus.',
    dark: false,
    background: '#f7f3e8',
    surface: '#fffdf6',
    surfaceRaised: '#efe8d6',
    border: '#ddd2b8',
    text: '#2b2419',
    textMuted: '#7a6f5c',
    accent: '#b3452e',
    pure: '#1f7a5e',
    tone: '#35618f',
    danger: '#a32c30',
    keyWhite: '#fffdf6',
    keyBlack: '#3a3226',
  },

  flygel: {
    label: 'Flygel',
    description: 'Svart och vitt med mässing, som ett flygellock och dess beslag.',
    dark: false,
    background: '#f2f2f4',
    surface: '#ffffff',
    surfaceRaised: '#e8e8ec',
    border: '#d0d0d8',
    text: '#16161a',
    textMuted: '#6b6b78',
    accent: '#9a7b32',
    pure: '#2c7a63',
    tone: '#3a5f95',
    danger: '#a8323c',
    keyWhite: '#ffffff',
    keyBlack: '#16161a',
  },

  pergament: {
    label: 'Pergament',
    description: 'Varm sepia med hög kontrast. Läsbar även i starkt solljus.',
    dark: false,
    background: '#efe6d4',
    surface: '#f9f2e3',
    surfaceRaised: '#e4d8c0',
    border: '#cbbb9d',
    text: '#33291b',
    textMuted: '#7d6f57',
    accent: '#a8571f',
    pure: '#2b7355',
    tone: '#3d5f8a',
    danger: '#9e3226',
    keyWhite: '#f9f2e3',
    keyBlack: '#40352a',
  },
};

// ---------- Färghjälpmedel ----------

function tolka(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

const tvåsiffrigt = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

/** Blandar två färger. `del` 0 ger den första, 1 ger den andra. */
function blanda(a: string, b: string, del: number): string {
  const [ar, ag, ab] = tolka(a);
  const [br, bg, bb] = tolka(b);
  return `#${tvåsiffrigt(ar + (br - ar) * del)}${tvåsiffrigt(ag + (bg - ag) * del)}${tvåsiffrigt(ab + (bb - ab) * del)}`;
}

/**
 * Upplevd ljushet, 0 till 1. Viktad efter hur känsligt ögat är för varje
 * grundfärg — grönt uppfattas som ljusare än blått vid samma värde.
 */
function ljushet(hex: string): number {
  const [r, g, b] = tolka(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ---------- Den färdiga paletten ----------

export interface Palette extends ThemeCore {
  id: ThemeId;
  /** Text och ikoner ovanpå en platta i respektive färg. */
  onAccent: string;
  onPure: string;
  onTone: string;

  /** Kortbotten för det som just nu spelas: ytan med en skvätt accent i. */
  accentSurface: string;

  keyWhitePressed: string;
  keyWhiteBorder: string;
  keyBlackPressed: string;
  keyBlackBorder: string;
  /** Tonnamn på vita respektive svarta tangenter. */
  keyLabel: string;
  keyLabelBlack: string;

  /** Grundtonsmarkeringen på klaviaturen. */
  tonicBorder: string;
  tonicBlackBg: string;
  tonicBadgeBg: string;
}

export function buildPalette(id: ThemeId): Palette {
  const c = CORES[id] ?? CORES.konsertsal;

  // Den mörkaste respektive ljusaste tonen i temat, att lägga text mot.
  const bläck = c.dark ? c.background : c.text;
  const papper = c.dark ? c.text : c.surface;

  /**
   * Text ovanpå en färgad platta. Ljus platta får mörk text och tvärtom, med
   * en gnutta av plattans egen kulör inblandad så att det inte blir en hård
   * svart fläck mitt i en färgad yta.
   */
  const ovanpa = (färg: string) =>
    ljushet(färg) > 0.5 ? blanda(bläck, färg, 0.12) : blanda(papper, färg, 0.12);

  return {
    ...c,
    id,

    onAccent: ovanpa(c.accent),
    onPure: ovanpa(c.pure),
    onTone: ovanpa(c.tone),

    accentSurface: blanda(c.surface, c.accent, 0.18),

    keyWhitePressed: blanda(c.keyWhite, c.dark ? '#000000' : c.text, 0.16),
    // Kanten måste dras mot temats mörka ände, inte mot textfärgen. I ett
    // mörkt tema är texten nästan vit, och en vit kant på en vit tangent
    // lämnade klaviaturen utan synliga skiljelinjer.
    keyWhiteBorder: blanda(c.keyWhite, bläck, 0.34),
    keyBlackPressed: blanda(c.keyBlack, c.text, 0.25),
    keyBlackBorder: blanda(c.keyBlack, '#000000', 0.35),
    keyLabel: blanda(c.keyWhite, c.text, 0.55),
    keyLabelBlack: blanda(c.keyBlack, c.text, 0.72),

    tonicBorder: blanda(c.pure, c.background, 0.4),
    tonicBlackBg: blanda(c.pure, c.background, 0.55),
    tonicBadgeBg: blanda(c.pure, '#ffffff', 0.5),
  };
}

export const THEME_ORDER: ThemeId[] = [
  'konsertsal',
  'katedral',
  'sammet',
  'nocturne',
  'notblad',
  'flygel',
  'pergament',
];

export const DEFAULT_THEME: ThemeId = 'konsertsal';

/** Namn och beskrivning utan att hela paletten behöver byggas. */
export const THEME_META: Record<ThemeId, { label: string; description: string; dark: boolean }> =
  Object.fromEntries(
    (Object.keys(CORES) as ThemeId[]).map((id) => [
      id,
      { label: CORES[id].label, description: CORES[id].description, dark: CORES[id].dark },
    ]),
  ) as Record<ThemeId, { label: string; description: string; dark: boolean }>;

/**
 * Standardtemat som färdig palett. Finns för moduler som behöver en färg utan
 * att vara med i React-trädet; allt som ritas ska i stället använda useTheme.
 */
export const colors = buildPalette(DEFAULT_THEME);

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;
