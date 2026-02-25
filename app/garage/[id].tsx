import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { getMaintenanceRecords } from '../../services/maintenance-service';
import { getVehicleById } from '../../services/vehicle-service';
import type { MaintenanceRecord } from '../../types/maintenance';
import type { Vehicle } from '../../types/vehicle';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVehicle = useCallback(async () => {
    if (!user?.user_id || !id) return;

    setLoading(true);
    try {
      const [vehicleRow, maintenanceRows] = await Promise.all([
        getVehicleById(id, user.user_id),
        getMaintenanceRecords(id, user.user_id),
      ]);
      setVehicle(vehicleRow);
      setRecords(maintenanceRows.slice(0, 5));
    } catch (error) {
      console.warn('Could not load vehicle detail:', error);
    } finally {
      setLoading(false);
    }
  }, [id, user?.user_id]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  const title = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Vehicle Detail';

  return (
    <AppShell routeKey="vehicle-detail" title={title} subtitle="Vehicle profile and recent activity">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.brandAccent} />
        ) : !vehicle ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Vehicle not found</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/garage')}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonInteraction,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Back to Garage</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <Text style={styles.profileName}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonInteraction,
                    ]}
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
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.background} />
                    <Text style={styles.primaryButtonText}>Open AI Chat</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.buttonInteraction,
                    ]}
                    onPress={() => router.push('/maintenance/new')}
                  >
                    <Text style={styles.secondaryButtonText}>Log Maintenance</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.metaGrid}>
                <MetaItem label="VIN" value={vehicle.vin ? `***${vehicle.vin.slice(-6)}` : 'Not set'} />
                <MetaItem
                  label="Mileage"
                  value={
                    vehicle.current_mileage
                      ? `${vehicle.current_mileage.toLocaleString()} mi`
                      : 'Not set'
                  }
                />
                <MetaItem label="Color" value={vehicle.color || 'Not set'} />
                <MetaItem label="Plate" value={vehicle.license_plate || 'Not set'} />
              </View>
            </View>

            <View style={styles.recordsCard}>
              <Text style={styles.recordsTitle}>Recent Maintenance</Text>
              {records.length === 0 ? (
                <Text style={styles.recordsEmpty}>No maintenance records yet.</Text>
              ) : (
                records.map((record) => (
                  <View key={record.record_id} style={styles.recordRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordTitle}>{record.title}</Text>
                      <Text style={styles.recordMeta}>{record.type} | {record.date}</Text>
                    </View>
                    <Text style={styles.recordCost}>
                      {record.cost ? `$${record.cost.toFixed(2)}` : '--'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
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
  emptyState: {
    minHeight: 220,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.lg,
  },
  profileCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 14,
  },
  profileHeader: {
    gap: 10,
  },
  profileName: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.xl,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.brandAccent,
    paddingHorizontal: 14,
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
  secondaryButton: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    minWidth: 180,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  metaLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
  },
  metaValue: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  recordsCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  recordsTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.md,
  },
  recordsEmpty: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  recordRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  recordMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
    marginTop: 3,
  },
  recordCost: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.sm,
  },
  buttonInteraction: {
    opacity: 0.92,
  },
});
