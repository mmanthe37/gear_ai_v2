/**
 * Gear AI – Standardised Button
 *
 * Three size variants with consistent touch targets, theme colours,
 * built-in accessibility props, and pressed-state feedback.
 */

import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, touchMinHeight, pressedOpacity } from '../../theme/spacing';
import { radii } from '../../theme/tokens';
import { typeScale, fontFamilies, fontWeights } from '../../theme/typography';

type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  size?: ButtonSize;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

const SIZE_MAP: Record<ButtonSize, { height: number; px: number; fontSize: number }> = {
  sm: { height: 36, px: sp[3], fontSize: typeScale.sm },
  md: { height: touchMinHeight, px: sp[4], fontSize: typeScale.md },
  lg: { height: 52, px: sp[6], fontSize: typeScale.lg },
};

export default function Button({
  title,
  onPress,
  size = 'md',
  variant = 'primary',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const s = SIZE_MAP[size];

  const bg = (): string => {
    if (disabled) return colors.disabled;
    switch (variant) {
      case 'primary': return colors.brandAccent;
      case 'secondary': return colors.surfaceAlt;
      case 'danger': return colors.danger;
      case 'ghost': return 'transparent';
    }
  };

  const fg = (): string => {
    if (disabled) return colors.disabledText;
    switch (variant) {
      case 'primary': return '#FFFFFF';
      case 'secondary': return colors.textPrimary;
      case 'danger': return '#FFFFFF';
      case 'ghost': return colors.brandAccent;
    }
  };

  const borderStyle = (): ViewStyle => {
    if (variant === 'ghost') return { borderWidth: 1, borderColor: disabled ? colors.disabled : colors.border };
    if (variant === 'secondary') return { borderWidth: 1, borderColor: colors.border };
    return {};
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: Math.max(s.height, touchMinHeight),
          paddingHorizontal: s.px,
          backgroundColor: bg(),
          opacity: pressed ? pressedOpacity : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        borderStyle(),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg()} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons name={icon} size={s.fontSize + 2} color={fg()} style={styles.iconLeft} />
          )}
          <Text
            style={[
              styles.label,
              { fontSize: s.fontSize, color: fg() },
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons name={icon} size={s.fontSize + 2} color={fg()} style={styles.iconRight} />
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    gap: sp[2],
  },
  label: {
    fontFamily: fontFamilies.body,
    fontWeight: fontWeights.semibold,
  },
  iconLeft: { marginRight: sp[1] },
  iconRight: { marginLeft: sp[1] },
});
