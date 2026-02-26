import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  variant?: 'default' | 'performance' | 'warning' | 'success';
}

export default function GlassCard({
  children,
  style,
  intensity = 25,
  tint,
  variant = 'default'
}: GlassCardProps) {
  const { theme, colors } = useTheme();
  const resolvedTint = tint ?? (theme === 'light' ? 'light' : 'dark');

  const getGradientColors = (): readonly [string, string, string] => {
    switch (variant) {
      case 'performance':
        return [
          'rgba(255, 69, 0, 0.3)',
          'rgba(255, 140, 0, 0.2)',
          'rgba(255, 69, 0, 0.1)'
        ] as const;
      case 'warning':
        return [
          'rgba(255, 193, 7, 0.3)',
          'rgba(255, 235, 59, 0.2)',
          'rgba(255, 193, 7, 0.1)'
        ] as const;
      case 'success':
        return [
          'rgba(76, 175, 80, 0.3)',
          'rgba(139, 195, 74, 0.2)',
          'rgba(76, 175, 80, 0.1)'
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
        return 'rgba(255, 69, 0, 0.4)';
      case 'warning':
        return 'rgba(255, 193, 7, 0.4)';
      case 'success':
        return 'rgba(76, 175, 80, 0.4)';
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
      padding: 20,
    },
  });

  return (
    <View style={[styles.container, style]}>
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