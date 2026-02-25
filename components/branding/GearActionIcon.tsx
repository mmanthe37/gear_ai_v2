import React from 'react';
import { Image } from 'react-native';
import type { StyleProp, ImageStyle } from 'react-native';

type GearActionIconSize = 'xs' | 'sm' | 'md' | 'lg';

export interface GearActionIconProps {
  size?: GearActionIconSize;
  decorative?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ImageStyle>;
}

const ICON_SIZES: Record<GearActionIconSize, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
};

export default function GearActionIcon({
  size = 'sm',
  decorative = true,
  accessibilityLabel = 'Gear action',
  style,
}: GearActionIconProps) {
  const pixelSize = ICON_SIZES[size];

  return (
    <Image
      source={require('../../assets/branding/gearai-button-symbol.png')}
      resizeMode="contain"
      style={[{ width: pixelSize, height: pixelSize }, style]}
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      importantForAccessibility={decorative ? 'no' : 'auto'}
    />
  );
}
