import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import GearLogo from '../components/branding/GearLogo';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { sp } from '../theme/spacing';

export default function Index() {
  const { colors } = useTheme();
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View
        accessibilityLabel="Loading session"
        style={[styles.loadingState, { backgroundColor: colors.background }]}
      >
        <GearLogo variant="micro" size="lg" style={styles.loadingLogo} />
        <ActivityIndicator size="large" color={colors.brandAccent} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/garage" />;
}

const styles = StyleSheet.create({
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    marginBottom: sp[4],
  },
});
