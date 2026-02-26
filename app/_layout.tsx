import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import GearLogo from '../components/branding/GearLogo';
import ErrorBoundary from '../components/ErrorBoundary';
import { AuthProvider } from '../contexts/AuthContext';
import { AppShellProvider } from '../contexts/AppShellContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { darkColors as colors } from '../theme/tokens';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Orbitron: require('../assets/fonts/Orbitron-VariableFont_wght.ttf'),
    Manrope: require('../assets/fonts/Manrope-VariableFont_wght.ttf'),
  });

  return (
    <ErrorBoundary>
      <ThemeProvider>
        {!fontsLoaded ? (
          <View style={styles.loading}>
            <GearLogo variant="micro" size="lg" style={styles.loadingLogo} />
            <ActivityIndicator size="large" color={colors.brandAccent} />
          </View>
        ) : (
          <AuthProvider>
            <AppShellProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false }} />
            </AppShellProvider>
          </AuthProvider>
        )}
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingLogo: {
    marginBottom: 14,
  },
});
