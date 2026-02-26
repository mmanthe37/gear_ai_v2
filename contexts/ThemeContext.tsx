/**
 * Gear AI CoPilot - Theme Context
 *
 * Provides live light/dark/AMOLED theme switching across the app.
 * Persists the selected theme to AsyncStorage for instant restore on launch.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, amoledColors, ThemeMode } from '../theme/tokens';

const THEME_STORAGE_KEY = '@gear_ai_theme_mode';

export type ThemeColors = typeof darkColors;

interface ThemeContextType {
  theme: ThemeMode;
  colors: ThemeColors;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

function resolveColors(mode: ThemeMode): ThemeColors {
  if (mode === 'light') return lightColors;
  if (mode === 'amoled') return amoledColors;
  return darkColors;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'amoled') {
        setThemeState(saved as ThemeMode);
      }
    });
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {
      // Storage failure is non-fatal; theme still applied in-session
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: resolveColors(theme), setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
