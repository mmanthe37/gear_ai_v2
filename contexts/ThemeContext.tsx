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
const ACCENT_STORAGE_KEY = '@gear_ai_accent_color';

export type ThemeColors = typeof darkColors;

interface ThemeContextType {
  theme: ThemeMode;
  colors: ThemeColors;
  setTheme: (mode: ThemeMode) => void;
  accentColor: string | null;
  setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

function resolveColors(mode: ThemeMode, accentOverride?: string | null): ThemeColors {
  const base = mode === 'light' ? lightColors : mode === 'amoled' ? amoledColors : darkColors;
  if (!accentOverride) return base;
  return {
    ...base,
    brandAccent: accentOverride,
    accentTint: accentOverride + '20',
    accentTintStrong: accentOverride + '30',
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [accentColor, setAccentColorState] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(THEME_STORAGE_KEY),
      AsyncStorage.getItem(ACCENT_STORAGE_KEY),
    ]).then(([savedTheme, savedAccent]) => {
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'amoled') {
        setThemeState(savedTheme as ThemeMode);
      }
      if (savedAccent) {
        setAccentColorState(savedAccent);
      }
    });
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {
      // Storage failure is non-fatal; theme still applied in-session
    });
  };

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    AsyncStorage.setItem(ACCENT_STORAGE_KEY, color).catch(() => {
      // Storage failure is non-fatal; accent still applied in-session
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: resolveColors(theme, accentColor), setTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}
