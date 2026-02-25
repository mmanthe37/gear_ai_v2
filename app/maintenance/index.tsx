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
import { getAllUserMaintenanceRecords } from '../../services/maintenance-service';
import { getUserVehicles } from '../../services/vehicle-service';
import type { MaintenanceRecord } from '../../types/maintenance';
import type { Vehicle } from '../../types/vehicle';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MaintenanceScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filter, setFilter] = useState<'all' | 'routine' | 'repair'>('all');

  const loadData = useCallback(async () => {
    if (!user?.user_id) return;
    setLoading(true);
    try {
      const [recordRows, vehicleRows] = await Promise.all([
        getAllUserMaintenanceRecords(user.user_id),
        getUserVehicles(user.user_id),
      ]);
      setRecords(recordRows);
      setVehicles(vehicleRows);
    } catch (error) {
      console.warn('Could not load maintenance data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const vehicleMap = useMemo(() => {
    return new Map(vehicles.map((vehicle) => [vehicle.vehicle_id, `${vehicle.year} ${vehicle.make} ${vehicle.model}`]));
  }, [vehicles]);

  const filteredRecords = useMemo(() => {
    if (filter === 'all') return records;
    return records.filter((record) => record.type === filter);
  }, [filter, records]);

  return (
    <AppShell routeKey="maintenance" title="Maintenance" subtitle="Track repairs, routine services, and costs">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>Service Timeline</Text>
            <Text style={styles.panelSubtitle}>All maintenance records in one view.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/maintenance/new')}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonInteraction,
            ]}
          >
            <Ionicons name="add" size={16} color={colors.background} />
            <Text style={styles.primaryButtonText}>New Record</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {(['all', 'routine', 'repair'] as const).map((type) => {
            const active = filter === type;
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                onPress={() => setFilter(type)}
                style={({ pressed }) => [
                  styles.filterButton,
                  active && styles.filterButtonActive,
                  pressed && styles.buttonInteraction,
                ]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {type === 'all' ? 'All' : type === 'routine' ? 'Routine' : 'Repairs'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.recordsWrap}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.brandAccent} style={{ marginTop: 20 }} />
          ) : filteredRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="build-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No maintenance records</Text>
              <Text style={styles.emptySubtitle}>Add a service record to build your maintenance history.</Text>
            </View>
          ) : (
            filteredRecords.map((record) => (
              <View key={record.record_id} style={styles.recordCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordTitle}>{record.title}</Text>
                  <Text style={styles.recordMeta}>
                    {vehicleMap.get(record.vehicle_id) || record.vehicle_id} | {formatDate(record.date)}
                  </Text>
                  {record.description ? <Text style={styles.recordDescription}>{record.description}</Text> : null}
                </View>
                <View style={styles.recordSide}>
                  <Text style={styles.recordType}>{record.type}</Text>
                  <Text style={styles.recordCost}>{record.cost ? `$${record.cost.toFixed(2)}` : '--'}</Text>
                </View>
              </View>
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
    gap: 12,
  },
  panelHeader: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  filterButtonActive: {
    borderColor: colors.brandAccent,
    backgroundColor: 'rgba(51, 214, 210, 0.14)',
  },
  filterText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  filterTextActive: {
    color: colors.textPrimary,
  },
  recordsWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 10,
  },
  emptyState: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
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
  recordCard: {
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
    fontSize: typeScale.md,
  },
  recordMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
    marginTop: 2,
  },
  recordDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
    marginTop: 6,
  },
  recordSide: {
    alignItems: 'flex-end',
    gap: 6,
  },
  recordType: {
    color: colors.actionAccent,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
    textTransform: 'uppercase',
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
