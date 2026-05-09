import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Analytics } from '@vercel/analytics/react';
import GearLogo from '../components/branding/GearLogo';
import BackendStatus from '../components/BackendStatus';
import ErrorBoundary from '../components/ErrorBoundary';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AppShellProvider } from '../contexts/AppShellContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { sp } from '../theme/spacing';

function AppGate({ children }: { children: React.ReactNode }) {
  const { backendStatus, retryConnection } = useAuth();

  if (backendStatus === 'misconfigured' || backendStatus === 'unreachable') {
    return <BackendStatus issue={backendStatus} onRetry={retryConnection} />;
  }

  return <>{children}</>;
}

function RootLayoutInner() {
  const { theme, colors } = useTheme();
  const [fontsLoaded] = useFonts({
    Orbitron: require('../assets/fonts/Orbitron-VariableFont_wght.ttf'),
    Manrope: require('../assets/fonts/Manrope-VariableFont_wght.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View
        accessibilityLabel="Loading application"
        style={[styles.loading, { backgroundColor: colors.background }]}
      >
        <GearLogo variant="micro" size="lg" style={styles.loadingLogo} />
        <ActivityIndicator size="large" color={colors.brandAccent} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <AppGate>
        <AppShellProvider>
          <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
          <Stack screenOptions={{ headerShown: false }} />
          <Analytics />
        </AppShellProvider>
      </AppGate>
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    marginBottom: sp[4],
  },
});

