import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import GearActionIcon from '../../components/branding/GearActionIcon';
import GearLogo from '../../components/branding/GearLogo';
import ModernVehicleCard from '../../components/ModernVehicleCard';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { getUserVehicles } from '../../services/vehicle-service';
import type { Vehicle } from '../../types/vehicle';
import { radii } from '../../theme/tokens';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamilies, typeScale } from '../../theme/typography';

function StatTile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const tileStyles = StyleSheet.create({
    statTile: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: 14,
      minWidth: 150,
      flex: 1,
    },
    statValue: {
      color: colors.textPrimary,
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.xl,
    },
    statLabel: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
      marginTop: 4,
    },
  });
  return (
    <View style={tileStyles.statTile}>
      <Text style={tileStyles.statValue}>{value}</Text>
      <Text style={tileStyles.statLabel}>{label}</Text>
    </View>
  );
}

export default function GarageScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);

  const loadVehicles = useCallback(async () => {
    if (!user?.user_id) return;
    setLoading(true);
    try {
      const rows = await getUserVehicles(user.user_id);
      setVehicles(rows);
    } catch (error) {
      console.warn('Could not load vehicles:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const averageMileage = useMemo(() => {
    if (!vehicles.length) return 0;
    const sum = vehicles.reduce((acc, vehicle) => acc + (vehicle.current_mileage || 0), 0);
    return Math.round(sum / vehicles.length);
  }, [vehicles]);

  const styles = StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      padding: 16,
      gap: 16,
    },
    panel: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 16,
    },
    panelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
    },
    panelTitle: {
      color: colors.textPrimary,
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.lg,
    },
    panelSubtitle: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.sm,
      marginTop: 4,
    },
    primaryButton: {
      minHeight: 44,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      backgroundColor: colors.brandAccent,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryButtonText: {
      color: colors.background,
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.sm,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    listWrap: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 12,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.md,
    },
    emptyState: {
      minHeight: 180,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.md,
    },
    emptySubtitle: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.sm,
      textAlign: 'center',
    },
    chatButton: {
      minHeight: 36,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.full,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      alignSelf: 'flex-end',
      marginTop: -8,
      marginBottom: 8,
      marginRight: 4,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
    },
    buttonInteraction: {
      opacity: 0.92,
    },
  });

  return (
    <AppShell routeKey="garage" title="Garage" subtitle="Vehicle command center">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Fleet Overview</Text>
              <Text style={styles.panelSubtitle}>Manage vehicles and open AI conversations.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonInteraction,
              ]}
              onPress={() => router.push('/garage/new')}
            >
              <GearActionIcon size="md" />
              <Text style={styles.primaryButtonText}>Add Vehicle</Text>
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <StatTile label="Vehicles" value={String(vehicles.length)} />
            <StatTile label="Average Mileage" value={`${averageMileage.toLocaleString()} mi`} />
          </View>
        </View>

        <View style={styles.listWrap}>
          <Text style={styles.sectionTitle}>Garage Vehicles</Text>

          {loading ? (
            <ActivityIndicator size="large" color={colors.brandAccent} style={{ marginTop: 20 }} />
          ) : vehicles.length === 0 ? (
            <View style={styles.emptyState}>
              <GearLogo variant="micro" size="lg" />
              <Text style={styles.emptyTitle}>No vehicles added</Text>
              <Text style={styles.emptySubtitle}>Add your first vehicle to start using Gear AI CoPilot.</Text>
            </View>
          ) : (
            vehicles.map((vehicle) => (
              <View key={vehicle.vehicle_id}>
                <ModernVehicleCard
                  make={vehicle.make}
                  model={vehicle.model}
                  year={vehicle.year}
                  vin={vehicle.vin}
                  mileage={vehicle.current_mileage}
                  onPress={() => router.push(`/garage/${vehicle.vehicle_id}`)}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/chat/[id]',
                      params: {
                        id: vehicle.vehicle_id,
                        make: vehicle.make,
                        model: vehicle.model,
                        year: vehicle.year.toString(),
                      },
                    })
                  }
                  style={({ pressed }) => [
                    styles.chatButton,
                    pressed && styles.buttonInteraction,
                  ]}
                >
                  <GearActionIcon size="sm" />
                  <Text style={styles.secondaryButtonText}>Chat with AI</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

