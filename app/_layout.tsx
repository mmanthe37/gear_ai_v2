import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import GearLogo from '../components/branding/GearLogo';
import ErrorBoundary from '../components/ErrorBoundary';
import { AuthProvider } from '../contexts/AuthContext';
import { AppShellProvider } from '../contexts/AppShellContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { sp } from '../theme/spacing';

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
      <AppShellProvider>
        <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
        <Stack screenOptions={{ headerShown: false }} />
      </AppShellProvider>
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

