import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { radii } from '../../theme/tokens';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamilies, typeScale } from '../../theme/typography';
import type { VehicleHealthScore } from '../../types/diagnostic';

interface Props {
  score: number;
  trend?: VehicleHealthScore['trend'];
  size?: number;
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

function trendIcon(trend?: VehicleHealthScore['trend']): string {
  if (trend === 'improving') return '↑';
  if (trend === 'declining') return '↓';
  return '→';
}

export default function HealthScoreGauge({ score, trend, size = 140 }: Props) {
  const { colors } = useTheme();

  function scoreColor(s: number): string {
    if (s >= 80) return colors.success;
    if (s >= 60) return colors.warning;
    if (s >= 40) return '#F97316'; // orange
    return colors.danger;
  }

  function trendColor(t?: VehicleHealthScore['trend']): string {
    if (t === 'improving') return colors.success;
    if (t === 'declining') return colors.danger;
    return colors.textSecondary;
  }

  const styles = StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringBg: {
      position: 'absolute',
    },
    ringFg: {
      position: 'absolute',
    },
    inner: {
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    scoreNum: {
      fontFamily: fontFamilies.heading,
      lineHeight: undefined,
    },
    scoreLabel: {
      fontFamily: fontFamilies.body,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    trend: {
      fontFamily: fontFamilies.body,
      textTransform: 'capitalize',
      marginTop: 2,
    },
  });

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: score,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [anim, score]);

  const accent = scoreColor(score);
  const ring = size * 0.08;
  const inner = size - ring * 2;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {/* Outer ring background */}
      <View
        style={[
          styles.ringBg,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ring,
            borderColor: colors.border,
          },
        ]}
      />
      {/* Colored progress ring (simplified solid arc effect) */}
      <View
        style={[
          styles.ringFg,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ring,
            borderColor: accent,
            opacity: score / 100,
          },
        ]}
      />
      {/* Inner content */}
      <View style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        <Text style={[styles.scoreNum, { color: accent, fontSize: size * 0.26 }]}>
          {score}
        </Text>
        <Text style={[styles.scoreLabel, { color: accent, fontSize: size * 0.09 }]}>
          {scoreLabel(score)}
        </Text>
        {trend && (
          <Text style={[styles.trend, { color: trendColor(trend), fontSize: size * 0.1 }]}>
            {trendIcon(trend)} {trend}
          </Text>
        )}
      </View>
    </View>
  );
}

