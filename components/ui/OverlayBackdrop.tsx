/**
 * Gear AI – Modal Overlay Backdrop
 *
 * Theme-aware backdrop that replaces hardcoded rgba(0,0,0,0.5) overlays.
 * Tapping the backdrop fires onDismiss (if provided).
 */

import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { pressedOpacity } from '../../theme/spacing';

interface OverlayBackdropProps {
  onDismiss?: () => void;
  style?: ViewStyle;
}

export default function OverlayBackdrop({ onDismiss, style }: OverlayBackdropProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="none"
      accessibilityLabel="Close overlay"
      style={[
        StyleSheet.absoluteFill,
        styles.backdrop,
        { backgroundColor: colors.modalOverlay },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    zIndex: 0,
  },
});
