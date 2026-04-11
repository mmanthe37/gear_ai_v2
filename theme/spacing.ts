/**
 * Legacy spacing scale — kept for backward compatibility.
 * Prefer the `sp` 4px-grid tokens below for new code.
 * @deprecated Use sp4…sp48 instead.
 */
export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
};

/** 4 px-grid spacing tokens — canonical scale for new / modernised code. */
export const sp = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Minimum interactive touch-target dimension (Apple HIG). */
export const touchMinHeight = 44;

/** Standard pressed-state opacity for Pressable wrappers. */
export const pressedOpacity = 0.88;
