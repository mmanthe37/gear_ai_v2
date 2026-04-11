import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import GearActionIcon from '../../components/branding/GearActionIcon';
import GearLogo from '../../components/branding/GearLogo';
import AppShell from '../../components/layout/AppShell';
import { Badge, ErrorBanner } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getUserVehicles } from '../../services/vehicle-service';
import { sp, touchMinHeight, pressedOpacity } from '../../theme/spacing';
import { radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';
import type { Vehicle, VehicleStatus } from '../../types/vehicle';

const STATUS_LABELS: Record<VehicleStatus, string> = {
  active: 'Active', stored: 'Stored', for_sale: 'For Sale', sold: 'Sold', totaled: 'Totaled',
};

const STATUS_BADGE_VARIANTS: Record<VehicleStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  active: 'success',
  stored: 'info',
  for_sale: 'warning',
  sold: 'neutral',
  totaled: 'danger',
};

function StatTile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const tileStyles = StyleSheet.create({
    statTile: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.md,
      paddingVertical: sp[3],
      paddingHorizontal: sp[3],
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
      marginTop: sp[1],
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    if (!user?.user_id) return;
    setLoadError(null);
    setLoading(true);
    try {
      const rows = await getUserVehicles(user.user_id);
      setVehicles(rows);
    } catch (error) {
      console.warn('Could not load vehicles:', error);
      setLoadError((error as Error)?.message || 'Failed to load your garage.');
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

  const openManualLookup = useCallback((vehicle: Vehicle) => {
    router.push({
      pathname: '/manuals',
      params: {
        vehicleId: vehicle.vehicle_id,
        vin: vehicle.vin || '',
        year: vehicle.year.toString(),
        make: vehicle.make,
        model: vehicle.model,
      },
    });
  }, []);

  const styles = StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      padding: sp[4],
      gap: sp[4],
    },
    panel: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: sp[4],
      gap: sp[4],
    },
    panelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: sp[3],
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
      marginTop: sp[1],
    },
    primaryButton: {
      minHeight: touchMinHeight,
      borderRadius: radii.md,
      paddingHorizontal: sp[3],
      backgroundColor: colors.brandAccent,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: sp[2],
    },
    primaryButtonText: {
      color: colors.background,
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.sm,
    },
    statsRow: {
      flexDirection: 'row',
      gap: sp[3],
      flexWrap: 'wrap',
    },
    listWrap: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: sp[4],
      gap: sp[3],
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
      gap: sp[2],
      paddingHorizontal: sp[3],
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
    vehicleCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceAlt,
      minHeight: sp[16],
      paddingHorizontal: sp[3],
      paddingVertical: sp[3],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: sp[3],
    },
    vehicleInfoWrap: {
      flex: 1,
      minWidth: 0,
    },
    vehicleName: {
      color: colors.textPrimary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.md,
    },
    vehicleSubName: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
      marginTop: 1,
    },
    vehicleMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sp[2],
      marginTop: sp[1],
      flexWrap: 'wrap',
    },
    vehicleMeta: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
    },
    secondaryButton: {
      minHeight: 36,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.full,
      backgroundColor: colors.surface,
      paddingHorizontal: sp[3],
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: sp[2],
    },
    vehicleActions: {
      gap: sp[2],
      alignItems: 'flex-end',
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
    },
    buttonInteraction: {
      opacity: pressedOpacity,
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
              accessibilityLabel="Add Vehicle"
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

        {loadError && (
          <ErrorBanner
            message={`Failed to load: ${loadError}`}
            onDismiss={loadVehicles}
          />
        )}

        <View style={styles.listWrap}>
          <Text style={styles.sectionTitle}>Garage Vehicles</Text>

          {loading ? (
            <ActivityIndicator size="large" color={colors.brandAccent} style={{ marginTop: sp[5] }} />
          ) : vehicles.length === 0 ? (
            <View style={styles.emptyState}>
              <GearLogo variant="micro" size="lg" />
              <Text style={styles.emptyTitle}>No vehicles added</Text>
              <Text style={styles.emptySubtitle}>Add your first vehicle to start using Gear AI CoPilot.</Text>
            </View>
          ) : (
            vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.vehicle_id}
                accessibilityRole="button"
                accessibilityLabel={`View ${vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}`}
                style={({ pressed }) => [
                  styles.vehicleCard,
                  pressed && styles.buttonInteraction,
                ]}
                onPress={() => router.push(`/garage/${vehicle.vehicle_id}`)}
              >
                <View style={styles.vehicleInfoWrap}>
                  <Text style={styles.vehicleName}>
                    {vehicle.nickname
                      ? `${vehicle.nickname}`
                      : `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  </Text>
                  {vehicle.nickname && (
                    <Text style={styles.vehicleSubName}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </Text>
                  )}
                  <View style={styles.vehicleMetaRow}>
                    <Text style={styles.vehicleMeta}>
                      {vehicle.current_mileage
                        ? `${vehicle.current_mileage.toLocaleString()} mi`
                        : 'Mileage not set'}
                    </Text>
                    {vehicle.status && vehicle.status !== 'active' && (
                      <Badge
                        label={STATUS_LABELS[vehicle.status as VehicleStatus]}
                        variant={STATUS_BADGE_VARIANTS[vehicle.status as VehicleStatus]}
                        size="sm"
                      />
                    )}
                  </View>
                </View>

                <View style={styles.vehicleActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open manual for ${vehicle.make} ${vehicle.model}`}
                    onPress={() => openManualLookup(vehicle)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.buttonInteraction,
                    ]}
                  >
                    <Ionicons name="document-text-outline" size={14} color={colors.textPrimary} />
                    <Text style={styles.secondaryButtonText}>Manual</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Chat about ${vehicle.make} ${vehicle.model}`}
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
                      styles.secondaryButton,
                      pressed && styles.buttonInteraction,
                    ]}
                  >
                    <GearActionIcon size="sm" />
                    <Text style={styles.secondaryButtonText}>Chat</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}
