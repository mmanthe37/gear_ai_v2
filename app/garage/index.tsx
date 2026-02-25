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
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { getUserVehicles } from '../../services/vehicle-service';
import type { Vehicle } from '../../types/vehicle';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function GarageScreen() {
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
              <Ionicons name="add" size={18} color={colors.background} />
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
              <Ionicons name="car-sport-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No vehicles added</Text>
              <Text style={styles.emptySubtitle}>Add your first vehicle to start using Gear AI CoPilot.</Text>
            </View>
          ) : (
            vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.vehicle_id}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.vehicleCard,
                  pressed && styles.buttonInteraction,
                ]}
                onPress={() => router.push(`/garage/${vehicle.vehicle_id}`)}
              >
                <View style={styles.vehicleInfoWrap}>
                  <Text style={styles.vehicleName}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
                  <Text style={styles.vehicleMeta}>
                    {vehicle.current_mileage
                      ? `${vehicle.current_mileage.toLocaleString()} mi`
                      : 'Mileage not set'}
                  </Text>
                </View>

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
                    styles.secondaryButton,
                    pressed && styles.buttonInteraction,
                  ]}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textPrimary} />
                  <Text style={styles.secondaryButtonText}>Chat</Text>
                </Pressable>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

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
  vehicleCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
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
  vehicleMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
    marginTop: 2,
  },
  secondaryButton: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
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
