import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { colors, radii } from '../theme/tokens';
import { fontFamilies, typeScale } from '../theme/typography';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert('Sign out failed', error?.message || 'Please try again.');
    }
  };

  return (
    <AppShell routeKey="settings" title="Settings" subtitle="Account and platform preferences">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{user?.display_name || 'Not set'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email || 'Not set'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tier</Text>
            <Text style={styles.value}>{user?.tier || 'free'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session</Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.buttonInteraction,
            ]}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.md,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  signOutButton: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutText: {
    color: '#FCA5A5',
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.sm,
  },
  buttonInteraction: {
    opacity: 0.92,
  },
});
