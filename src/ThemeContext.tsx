/**
 * Ger komponenterna den aktuella paletten.
 *
 * Ligger skilt från AppState så att rena byggstenar som ui.tsx kan hämta färger
 * utan att dra in hela appens tillstånd.
 *
 * Stilar måste byggas inuti komponenten, inte på modulnivå:
 *
 *     const t = useTheme();
 *     const styles = useMemo(() => makeStyles(t), [t]);
 *
 * Ett `StyleSheet.create` utanför komponenten körs en gång när modulen laddas
 * och fryser färgerna som gällde då — då byter inget tema.
 */
import React, { createContext, useContext, useMemo } from 'react';

import { Palette, colors } from './theme';

const ThemeContext = createContext<Palette>(colors);

export function ThemeProvider({
  palette,
  children,
}: {
  palette: Palette;
  children: React.ReactNode;
}) {
  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Palette {
  return useContext(ThemeContext);
}

/**
 * Bygger stilarna en gång per tema i stället för vid varje omritning.
 * Taktvisaren ritas om sextio gånger i sekunden — där märks skillnaden.
 *
 * `make` måste vara en modulkonstant, annars byggs stilarna ändå om varje gång.
 */
export function useThemedStyles<S>(make: (t: Palette) => S): S {
  const t = useTheme();
  return useMemo(() => make(t), [make, t]);
}
