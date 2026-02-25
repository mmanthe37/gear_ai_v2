import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';
import type { ShellRouteKey } from '../../types/shell';
import { PRIMARY_NAV_ITEMS, getTopNavActiveKey } from './nav-config';

interface AppTopNavProps {
  routeKey: ShellRouteKey;
}

export default function AppTopNav({ routeKey }: AppTopNavProps) {
  const activeKey = getTopNavActiveKey(routeKey);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PRIMARY_NAV_ITEMS.map((item) => {
          const active = item.key === activeKey;
          return (
            <Pressable
              accessibilityRole="button"
              key={item.key}
              onPress={() => router.push(item.href as never)}
              style={({ pressed }) => [
                styles.button,
                active && styles.buttonActive,
                pressed && styles.buttonInteraction,
              ]}
            >
              <Text style={[styles.buttonText, active && styles.buttonTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(18, 26, 35, 0.8)',
    minHeight: 56,
    justifyContent: 'center',
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  buttonActive: {
    backgroundColor: 'rgba(51, 214, 210, 0.16)',
    borderColor: colors.brandAccent,
  },
  buttonInteraction: {
    opacity: 0.92,
  },
  buttonText: {
    color: colors.textSecondary,
    fontSize: typeScale.sm,
    fontFamily: fontFamilies.body,
  },
  buttonTextActive: {
    color: colors.textPrimary,
  },
});
