import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from '../../theme/tokens';
import { fontFamilies } from '../../theme/typography';

export interface GearLogoProps {
  variant?: 'icon' | 'full';
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  style?: StyleProp<ViewStyle>;
}

const ICON_SIZES = {
  sm: 30,
  md: 44,
  lg: 60,
};

const FULL_WIDTH = {
  sm: 180,
  md: 240,
  lg: 320,
};

export default function GearLogo({
  variant = 'icon',
  size = 'md',
  showWordmark = false,
  style,
}: GearLogoProps) {
  if (variant === 'full') {
    return (
      <View style={[styles.wrapper, style]}>
        <Image
          source={require('../../assets/branding/gearai-full.png')}
          resizeMode="contain"
          style={{ width: FULL_WIDTH[size], height: FULL_WIDTH[size] * 0.48 }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, styles.row, style]}>
      <Image
        source={require('../../assets/branding/gearai-icon.png')}
        resizeMode="contain"
        style={{ width: ICON_SIZES[size], height: ICON_SIZES[size] }}
      />
      {showWordmark && <Text style={styles.wordmark}>Gear AI</Text>}
    </View>
  );
}

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
    fontSize: 18,
    letterSpacing: 0.5,
    fontFamily: fontFamilies.heading,
  },
});
