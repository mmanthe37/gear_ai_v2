import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import GearLogo from '../components/branding/GearLogo';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/tokens';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <GearLogo variant="micro" size="lg" style={styles.loadingLogo} />
        <ActivityIndicator size="large" color={colors.brandAccent} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/garage" />;
}

const styles = StyleSheet.create({
  loadingState: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    marginBottom: 14,
  },
});
