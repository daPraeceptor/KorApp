/**
 * Mörkt tema med hög kontrast — appen används ofta i dunkla kyrkor och salar,
 * och ska kunna avläsas på en armlängds avstånd under pågående repetition.
 */
export const colors = {
  background: '#101018',
  surface: '#1c1c28',
  surfaceRaised: '#262635',
  border: '#33334a',

  text: '#f4f4f8',
  textMuted: '#9a9ab0',

  /** Tempo och metronom. */
  accent: '#f2a65a',
  /** Ren stämning och tonika. */
  pure: '#5ee0b0',
  /** Sparade körtoner. */
  tone: '#7aa2f7',

  danger: '#f0616d',

  keyWhite: '#f4f4f8',
  keyWhitePressed: '#c9c9d6',
  keyBlack: '#22222e',
  keyBlackPressed: '#4a4a60',
  keyLabel: '#5a5a70',
} as const;

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
