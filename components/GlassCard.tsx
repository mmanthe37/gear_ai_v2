import React from 'react';
import { View, StyleSheet, ViewStyle, AccessibilityRole } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';
import { sp } from '../theme/spacing';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  variant?: 'default' | 'performance' | 'warning' | 'success';
  accessibilityRole?: AccessibilityRole;
}

export default function GlassCard({
  children,
  style,
  intensity = 25,
  tint,
  variant = 'default',
  accessibilityRole,
}: GlassCardProps) {
  const { theme, colors } = useTheme();
  const resolvedTint = tint ?? (theme === 'light' ? 'light' : 'dark');

  const getGradientColors = (): readonly [string, string, string] => {
    switch (variant) {
      case 'performance':
        return [
          `${colors.danger}4D`,
          `${colors.danger}33`,
          `${colors.danger}1A`,
        ] as const;
      case 'warning':
        return [
          `${colors.warning}4D`,
          `${colors.warning}33`,
          `${colors.warning}1A`,
        ] as const;
      case 'success':
        return [
          `${colors.success}4D`,
          `${colors.success}33`,
          `${colors.success}1A`,
        ] as const;
      default:
        return [
          `${colors.cardGlow}`,
          `${colors.cardGlow}80`,
          `${colors.cardGlow}40`
        ] as const;
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case 'performance':
        return `${colors.danger}66`;
      case 'warning':
        return `${colors.warning}66`;
      case 'success':
        return `${colors.success}66`;
      default:
        return colors.border;
    }
  };

  const styles = StyleSheet.create({
    container: {
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: theme === 'light' ? 0.1 : 0.25,
      shadowRadius: 32,
      elevation: 12,
    },
    blur: {
      flex: 1,
      borderRadius: 16,
    },
    gradient: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1.5,
      backgroundColor: colors.surface,
    },
    content: {
      flex: 1,
      padding: sp[5],
    },
  });

  return (
    <View style={[styles.container, style]} accessibilityRole={accessibilityRole}>
      <BlurView
        intensity={intensity}
        tint={resolvedTint}
        style={styles.blur}
      >
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { borderColor: getBorderColor() }]}
        >
          <View style={styles.content}>
            {children}
          </View>
        </LinearGradient>
      </BlurView>
    </View>
  );
}