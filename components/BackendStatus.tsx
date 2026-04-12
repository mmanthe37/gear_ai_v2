import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { sp } from '../theme/spacing';
import { radii } from '../theme/tokens';
import { fontFamilies, typeScale } from '../theme/typography';

export type BackendIssue = 'misconfigured' | 'unreachable';

interface BackendStatusProps {
  issue: BackendIssue;
  onRetry?: () => void;
}

const COPY: Record<BackendIssue, { title: string; body: string; hint: string }> = {
  misconfigured: {
    title: 'Configuration Error',
    body: 'The app is missing its backend configuration. Environment variables for Supabase were not set at build time.',
    hint: 'If you are the developer, set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your deployment environment, then redeploy.',
  },
  unreachable: {
    title: 'Service Unavailable',
    body: 'We can\u2019t reach our servers right now. This may be a temporary outage or a network issue on your end.',
    hint: 'Please check your internet connection and try again. If the problem persists, the service may be undergoing maintenance.',
  },
};

export default function BackendStatus({ issue, onRetry }: BackendStatusProps) {
  const { colors } = useTheme();
  const copy = COPY[issue];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Image
          source={require('../assets/branding/gearai-icon-micro.png')}
          resizeMode="contain"
          style={styles.logo}
          accessible={false}
        />

        <Text style={[styles.title, { color: colors.danger }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: colors.textPrimary }]}>{copy.body}</Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{copy.hint}</Text>

        {issue === 'unreachable' && onRetry && (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.brandAccent, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Retry connection"
          >
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sp[5],
  },
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: sp[6],
    maxWidth: 480,
    width: '100%',
    alignItems: 'center',
    gap: sp[3],
  },
  logo: {
    width: 40,
    height: 40,
    marginBottom: sp[2],
  },
  title: {
    fontSize: typeScale.xl,
    fontFamily: fontFamilies.heading,
    textAlign: 'center',
  },
  body: {
    fontSize: typeScale.md,
    fontFamily: fontFamilies.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  hint: {
    fontSize: typeScale.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: sp[3],
    paddingVertical: sp[3],
    paddingHorizontal: sp[6],
    borderRadius: radii.md,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: typeScale.md,
    fontFamily: fontFamilies.body,
    fontWeight: '600',
  },
});
