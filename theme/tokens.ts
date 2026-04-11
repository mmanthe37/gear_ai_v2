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
  gradientStart: '#0B1117',
  gradientMid: '#0E1620',
  gradientEnd: '#0B1117',
  headerBg: 'rgba(18, 26, 35, 0.92)',
  sidebarBg: 'rgba(18, 26, 35, 0.94)',
  navBg: 'rgba(18, 26, 35, 0.8)',
  accentTint: 'rgba(51, 214, 210, 0.12)',
  accentTintStrong: 'rgba(51, 214, 210, 0.16)',
  cardGlow: 'rgba(30, 144, 255, 0.2)',
  loadingOverlay: 'rgba(11, 17, 23, 0.35)',
  // Semantic – banners / feedback
  successBannerBg: 'rgba(34, 197, 94, 0.12)',
  warningBannerBg: 'rgba(245, 158, 11, 0.14)',
  dangerBannerBg: 'rgba(239, 68, 68, 0.12)',
  // Semantic – modal overlay
  modalOverlay: 'rgba(4, 8, 12, 0.60)',
  // Semantic – disabled state
  disabled: '#3A4A5C',
  disabledText: '#6B7B8D',
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
  gradientStart: '#F0F4F8',
  gradientMid: '#E8EEF4',
  gradientEnd: '#F0F4F8',
  headerBg: 'rgba(255, 255, 255, 0.95)',
  sidebarBg: 'rgba(248, 250, 252, 0.97)',
  navBg: 'rgba(255, 255, 255, 0.9)',
  accentTint: 'rgba(14, 165, 233, 0.10)',
  accentTintStrong: 'rgba(14, 165, 233, 0.16)',
  cardGlow: 'rgba(14, 165, 233, 0.12)',
  loadingOverlay: 'rgba(255, 255, 255, 0.5)',
  successBannerBg: 'rgba(22, 163, 74, 0.10)',
  warningBannerBg: 'rgba(217, 119, 6, 0.10)',
  dangerBannerBg: 'rgba(220, 38, 38, 0.10)',
  modalOverlay: 'rgba(15, 23, 42, 0.50)',
  disabled: '#CBD5E1',
  disabledText: '#94A3B8',
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
  gradientStart: '#000000',
  gradientMid: '#050505',
  gradientEnd: '#000000',
  headerBg: 'rgba(0, 0, 0, 0.95)',
  sidebarBg: 'rgba(0, 0, 0, 0.97)',
  navBg: 'rgba(0, 0, 0, 0.9)',
  accentTint: 'rgba(51, 214, 210, 0.12)',
  accentTintStrong: 'rgba(51, 214, 210, 0.16)',
  cardGlow: 'rgba(74, 163, 255, 0.15)',
  loadingOverlay: 'rgba(0, 0, 0, 0.5)',
  successBannerBg: 'rgba(34, 197, 94, 0.12)',
  warningBannerBg: 'rgba(245, 158, 11, 0.14)',
  dangerBannerBg: 'rgba(239, 68, 68, 0.12)',
  modalOverlay: 'rgba(0, 0, 0, 0.75)',
  disabled: '#2A2A2A',
  disabledText: '#555555',
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

/** Cross-platform shadow / elevation presets. */
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
