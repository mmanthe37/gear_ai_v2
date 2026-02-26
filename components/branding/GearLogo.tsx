import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamilies } from '../../theme/typography';

type GearLogoVariant = 'icon' | 'full' | 'wordmark' | 'micro';
type GearLogoSize = 'xs' | 'sm' | 'md' | 'lg';

export interface GearLogoProps {
  variant?: GearLogoVariant;
  size?: GearLogoSize;
  showWordmark?: boolean;
  showTrademark?: boolean;
  decorative?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const ICON_SIZES: Record<GearLogoSize, number> = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 54,
};

const MICRO_SIZES: Record<GearLogoSize, number> = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 30,
};

const FULL_SIZE: Record<GearLogoSize, { width: number; height: number }> = {
  xs: { width: 96, height: 96 },
  sm: { width: 134, height: 134 },
  md: { width: 188, height: 188 },
  lg: { width: 248, height: 248 },
};

const WORDMARK_SIZE: Record<GearLogoSize, { width: number; height: number }> = {
  xs: { width: 96, height: 34 },
  sm: { width: 126, height: 42 },
  md: { width: 180, height: 60 },
  lg: { width: 260, height: 90 },
};

const COMPACT_WORDMARK_SIZE: Record<GearLogoSize, number> = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 20,
};

function defaultAccessibilityLabel(variant: GearLogoVariant, showWordmark: boolean): string {
  if (variant === 'full') return 'GEAR AI CoPilot full logo';
  if (variant === 'wordmark') return 'GEAR AI CoPilot wordmark';
  if (variant === 'micro') return 'GEAR AI CoPilot symbol';
  return showWordmark ? 'GEAR AI CoPilot logo and wordmark' : 'GEAR AI CoPilot symbol';
}

export default function GearLogo({
  variant = 'icon',
  size = 'md',
  showWordmark = false,
  showTrademark = false,
  decorative = true,
  accessibilityLabel,
  style,
}: GearLogoProps) {
  const { colors } = useTheme();
  const fullSize = FULL_SIZE[size];
  const wordmarkSize = WORDMARK_SIZE[size];
  const iconSize = ICON_SIZES[size];
  const microSize = MICRO_SIZES[size];
  const imageLabel = accessibilityLabel || defaultAccessibilityLabel(variant, showWordmark);
  const accessibilityProps = {
    accessible: !decorative,
    accessibilityRole: decorative ? undefined : ('image' as const),
    accessibilityLabel: decorative ? undefined : imageLabel,
    importantForAccessibility: decorative ? ('no-hide-descendants' as const) : ('auto' as const),
  };

  const styles = StyleSheet.create({
    wrapper: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    row: {
      flexDirection: 'row',
      gap: 10,
    },
    wordmark: {
      color: colors.textPrimary,
      letterSpacing: 0.4,
      fontFamily: fontFamilies.heading,
    },
  });

  if (variant === 'full') {
    return (
      <View style={[styles.wrapper, style]} {...accessibilityProps}>
        <Image
          source={require('../../assets/branding/gearai-full.png')}
          resizeMode="contain"
          style={fullSize}
          accessible={false}
          importantForAccessibility="no"
        />
      </View>
    );
  }

  if (variant === 'wordmark') {
    return (
      <View style={[styles.wrapper, style]} {...accessibilityProps}>
        <Image
          source={require('../../assets/branding/gearai-wordmark.png')}
          resizeMode="contain"
          style={wordmarkSize}
          accessible={false}
          importantForAccessibility="no"
        />
      </View>
    );
  }

  if (variant === 'micro') {
    return (
      <View style={[styles.wrapper, style]} {...accessibilityProps}>
        <Image
          source={require('../../assets/branding/gearai-icon-micro.png')}
          resizeMode="contain"
          style={{ width: microSize, height: microSize }}
          accessible={false}
          importantForAccessibility="no"
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, styles.row, style]} {...accessibilityProps}>
      <Image
        source={require('../../assets/branding/gearai-icon.png')}
        resizeMode="contain"
        style={{ width: iconSize, height: iconSize }}
        accessible={false}
        importantForAccessibility="no"
      />
      {showWordmark && (
        <Text style={[styles.wordmark, { fontSize: COMPACT_WORDMARK_SIZE[size] }]}>
          {showTrademark ? 'GEAR AI CoPilot™' : 'GEAR AI CoPilot'}
        </Text>
      )}
    </View>
  );
}

