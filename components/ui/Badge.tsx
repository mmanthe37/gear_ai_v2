/**
 * Gear AI – Status / Severity Badge
 *
 * Semantic colour mapping with text label. Supports both
 * generic severity variants and custom colour pass-through.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { sp } from '../../theme/spacing';
import { radii } from '../../theme/tokens';
import { typeScale, fontFamilies, fontWeights } from '../../theme/typography';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  /** Override background colour (ignores variant). */
  color?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function Badge({
  label,
  variant = 'neutral',
  color,
  size = 'sm',
  style,
}: BadgeProps) {
  const { colors } = useTheme();

  const variantColor = (): string => {
    switch (variant) {
      case 'success': return colors.success;
      case 'warning': return colors.warning;
      case 'danger': return colors.danger;
      case 'info': return colors.actionAccent;
      case 'neutral': return colors.textSecondary;
    }
  };

  const base = color ?? variantColor();
  const isSmall = size === 'sm';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.container,
        {
          backgroundColor: base + '22',
          paddingVertical: isSmall ? sp[1] : sp[2],
          paddingHorizontal: isSmall ? sp[2] : sp[3],
        },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: base }]} />
      <Text
        style={[
          styles.label,
          {
            color: base,
            fontSize: isSmall ? typeScale.xs : typeScale.sm,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.full,
    gap: sp[1],
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: fontFamilies.body,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
  },
});
