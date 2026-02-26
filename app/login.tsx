import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import GearLogo from '../components/branding/GearLogo';
import { useAuth } from '../contexts/AuthContext';
import { radii } from '../theme/tokens';
import { useTheme } from '../contexts/ThemeContext';
import { fontFamilies, typeScale } from '../theme/typography';

export default function LoginScreen() {
  const { colors } = useTheme();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signIn, signUp } = useAuth();

  const handleSubmit = async () => {
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
        Alert.alert(
          'Check your email',
          'A confirmation link has been sent to ' + email + '. Please confirm your email then sign in.',
          [{ text: 'OK', onPress: () => setIsSignUp(false) }]
        );
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
      paddingHorizontal: 18,
      paddingVertical: 30,
      gap: 22,
    },
    hero: {
      alignItems: 'center',
      gap: 8,
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
      padding: 18,
      gap: 14,
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
      gap: 6,
    },
    label: {
      color: colors.textSecondary,
      fontSize: typeScale.sm,
      fontFamily: fontFamilies.body,
    },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceAlt,
      color: colors.textPrimary,
      paddingHorizontal: 12,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.md,
    },
    submitButton: {
      minHeight: 44,
      borderRadius: radii.md,
      backgroundColor: colors.brandAccent,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 6,
    },
    submitButtonText: {
      color: colors.background,
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.sm,
    },
    toggle: {
      minHeight: 44,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    toggleText: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.sm,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonInteraction: {
      opacity: 0.92,
    },
  });

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
              />
            </View>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.buttonInteraction,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.submitButtonText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.toggle, pressed && styles.buttonInteraction]}
              onPress={() => setIsSignUp((prev) => !prev)}
              disabled={isLoading}
            >
              <Text style={styles.toggleText}>
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

