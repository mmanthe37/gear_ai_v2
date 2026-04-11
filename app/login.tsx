import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import GearLogo from '../components/branding/GearLogo';
import { Button, ErrorBanner } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { sp, touchMinHeight } from '../theme/spacing';
import { radii } from '../theme/tokens';
import { fontFamilies, typeScale } from '../theme/typography';

export default function LoginScreen() {
  const { colors } = useTheme();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const { signIn, signUp, session } = useAuth();

  const handleSubmit = async () => {
    setSuccessMessage('');
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUp({ email, password, display_name: displayName || undefined });
        setSuccessMessage(
          `Account created. We sent a confirmation link to ${email}. Confirm your email, then sign in below.`
        );
        setIsSignUp(false);
        setPassword('');
        setDisplayName('');
        return;
      } else {
        await signIn({ email, password });
      }
      router.replace('/garage');
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.toLowerCase().includes('email not confirmed')) {
        Alert.alert('Email not confirmed', 'Please check your inbox and click the confirmation link before signing in.');
      } else {
        Alert.alert('Authentication Error', msg || 'Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      minHeight: '100%',
      justifyContent: 'center',
      paddingHorizontal: sp[5],
      paddingVertical: sp[8],
      gap: sp[6],
    },
    hero: {
      alignItems: 'center',
      gap: sp[2],
    },
    heroTitle: {
      color: colors.textPrimary,
      fontSize: typeScale.lg,
      fontFamily: fontFamilies.heading,
      textAlign: 'center',
    },
    heroSubtitle: {
      color: colors.textSecondary,
      fontSize: typeScale.sm,
      fontFamily: fontFamilies.body,
      textAlign: 'center',
      maxWidth: 420,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      padding: sp[5],
      gap: sp[4],
      maxWidth: 520,
      alignSelf: 'center',
      width: '100%',
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: typeScale.xl,
      fontFamily: fontFamilies.heading,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    inputGroup: {
      gap: sp[2],
    },
    label: {
      color: colors.textSecondary,
      fontSize: typeScale.sm,
      fontFamily: fontFamilies.body,
    },
    input: {
      minHeight: touchMinHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceAlt,
      color: colors.textPrimary,
      paddingHorizontal: sp[3],
      fontFamily: fontFamilies.body,
      fontSize: typeScale.md,
    },
  });

  if (session) {
    return <Redirect href="/garage" />;
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <GearLogo
              variant="full"
              size="lg"
              decorative={false}
              accessibilityLabel="GEAR AI CoPilot full logo"
            />
            <GearLogo
              variant="wordmark"
              size="md"
              decorative={false}
              accessibilityLabel="GEAR AI CoPilot wordmark"
            />
            <Text style={styles.heroTitle}>Automotive Intelligence Platform</Text>
            <Text style={styles.heroSubtitle}>Clean, powerful assistance for every vehicle decision.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
              <GearLogo variant="micro" size="md" />
            </View>

            {!!successMessage && (
              <ErrorBanner
                variant="success"
                message={successMessage}
                onDismiss={() => setSuccessMessage('')}
              />
            )}

            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Display Name</Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  style={styles.input}
                  autoCapitalize="words"
                  placeholder="Alex Driver"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel="Display name"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder="you@example.com"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Email address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                autoCapitalize="none"
                secureTextEntry
                autoComplete="password"
                placeholder="password"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Password"
              />
            </View>

            <Button
              variant="primary"
              title={isSignUp ? 'Create Account' : 'Sign In'}
              onPress={handleSubmit}
              loading={isLoading}
              disabled={isLoading}
              fullWidth
              style={{ marginTop: sp[2] }}
              accessibilityHint="Submit the authentication form"
            />

            <Button
              variant="secondary"
              title={isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              onPress={() => {
                setSuccessMessage('');
                setIsSignUp((prev) => !prev);
              }}
              disabled={isLoading}
              fullWidth
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
