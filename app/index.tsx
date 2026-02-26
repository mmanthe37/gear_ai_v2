import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import GearLogo from '../components/branding/GearLogo';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Index() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();

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
