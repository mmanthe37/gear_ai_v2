/**
 * Gear AI – Feedback Banner
 *
 * Replaces the inline error/success/warning banners duplicated
 * across 5+ screens. Theme-aware with semantic colour tokens.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, pressedOpacity } from '../../theme/spacing';
import { radii } from '../../theme/tokens';
import { typeScale, fontFamilies, fontWeights } from '../../theme/typography';

type BannerVariant = 'error' | 'success' | 'warning' | 'info';

interface ErrorBannerProps {
  message: string;
  variant?: BannerVariant;
  onDismiss?: () => void;
  style?: ViewStyle;
}

const ICON_MAP: Record<BannerVariant, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  info: 'information-circle',
};

export default function ErrorBanner({
  message,
  variant = 'error',
  onDismiss,
  style,
}: ErrorBannerProps) {
  const { colors } = useTheme();

  const bg = (): string => {
    switch (variant) {
      case 'error': return colors.dangerBannerBg;
      case 'success': return colors.successBannerBg;
      case 'warning': return colors.warningBannerBg;
      case 'info': return colors.accentTint;
    }
  };

  const fg = (): string => {
    switch (variant) {
      case 'error': return colors.danger;
      case 'success': return colors.success;
      case 'warning': return colors.warning;
      case 'info': return colors.actionAccent;
    }
  };

  const borderColor = fg() + '40';

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={`${variant}: ${message}`}
      style={[
        styles.container,
        { backgroundColor: bg(), borderColor },
        style,
      ]}
    >
      <Ionicons name={ICON_MAP[variant]} size={18} color={fg()} />
      <Text style={[styles.message, { color: fg() }]}>{message}</Text>
      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? pressedOpacity : 1 })}
        >
          <Ionicons name="close" size={16} color={fg()} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp[3],
    padding: sp[4],
    borderRadius: radii.md,
    borderWidth: 1,
  },
  message: {
    flex: 1,
    fontFamily: fontFamilies.body,
    fontWeight: fontWeights.medium,
    fontSize: typeScale.sm,
    lineHeight: typeScale.sm * 1.4,
  },
});
