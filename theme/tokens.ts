export type ThemeMode = 'dark' | 'light' | 'amoled';

export const darkColors = {
  background: '#0B1117',
  surface: '#121A23',
  surfaceAlt: '#172231',
  border: '#2A3A4C',
  textPrimary: '#EAF1F8',
  textSecondary: '#A6B4C3',
  brandAccent: '#33D6D2',
  actionAccent: '#4AA3FF',
  warning: '#F59E0B',
  success: '#22C55E',
  danger: '#EF4444',
  overlay: 'rgba(4, 8, 12, 0.72)',
};

export const lightColors = {
  background: '#F0F4F8',
  surface: '#FFFFFF',
  surfaceAlt: '#E8EEF4',
  border: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  brandAccent: '#0EA5E9',
  actionAccent: '#2563EB',
  warning: '#D97706',
  success: '#16A34A',
  danger: '#DC2626',
  overlay: 'rgba(15, 23, 42, 0.6)',
};

export const amoledColors = {
  background: '#000000',
  surface: '#0A0A0A',
  surfaceAlt: '#111111',
  border: '#1F1F1F',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  brandAccent: '#33D6D2',
  actionAccent: '#4AA3FF',
  warning: '#F59E0B',
  success: '#22C55E',
  danger: '#EF4444',
  overlay: 'rgba(0, 0, 0, 0.85)',
};

/** Backward-compatible alias — do not remove */
export const colors = darkColors;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const breakpoints = {
  mobile: 768,
  desktop: 1280,
};

export const shell = {
  sidebarExpanded: 300,
  sidebarCollapsed: 84,
  headerHeight: 86,
};
