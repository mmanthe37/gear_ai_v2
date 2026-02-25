import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { createMaintenanceRecord } from '../../services/maintenance-service';
import { getUserVehicles } from '../../services/vehicle-service';
import type { MaintenanceType } from '../../types/maintenance';
import type { Vehicle } from '../../types/vehicle';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';

const TYPES: { value: MaintenanceType; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'diagnostic', label: 'Diagnostic' },
  { value: 'modification', label: 'Modification' },
];

export default function MaintenanceNewScreen() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [vehicleId, setVehicleId] = useState('');
  const [type, setType] = useState<MaintenanceType>('routine');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mileage, setMileage] = useState('');
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!user?.user_id) return;
    setVehiclesLoading(true);
    getUserVehicles(user.user_id)
      .then((rows) => {
        setVehicles(rows);
        if (rows[0]) {
          setVehicleId(rows[0].vehicle_id);
        }
      })
      .catch((error) => console.warn('Could not load vehicles:', error))
      .finally(() => setVehiclesLoading(false));
  }, [user?.user_id]);

  const handleSave = async () => {
    if (!user?.user_id) {
      Alert.alert('Authentication required', 'Please sign in to create records.');
      return;
    }

    if (!vehicleId) {
      Alert.alert('Missing vehicle', 'Choose a vehicle first.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a service title.');
      return;
    }

    setSaving(true);
    try {
      await createMaintenanceRecord(vehicleId, user.user_id, {
        type,
        title: title.trim(),
        date,
        mileage: mileage ? parseInt(mileage, 10) : undefined,
        cost: cost ? parseFloat(cost) : undefined,
        description: description.trim() || undefined,
      });
      router.replace('/maintenance');
    } catch (error: any) {
      Alert.alert('Unable to save', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell routeKey="maintenance-new" title="New Maintenance Record" subtitle="Log service activity">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Record Details</Text>

          <View style={styles.group}>
            <Text style={styles.label}>Vehicle *</Text>
            {vehiclesLoading ? (
              <ActivityIndicator size="small" color={colors.brandAccent} />
            ) : (
              <View style={styles.chipRow}>
                {vehicles.map((vehicle) => {
                  const active = vehicleId === vehicle.vehicle_id;
                  return (
                    <Pressable
                      key={vehicle.vehicle_id}
                      accessibilityRole="button"
                      onPress={() => setVehicleId(vehicle.vehicle_id)}
                      style={({ pressed }) => [
                        styles.chip,
                        active && styles.chipActive,
                        pressed && styles.buttonInteraction,
                      ]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Type *</Text>
            <View style={styles.chipRow}>
              {TYPES.map((option) => {
                const active = type === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    onPress={() => setType(option.value)}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.buttonInteraction,
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Oil change"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.group, styles.column]}>
              <Text style={styles.label}>Date *</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={[styles.group, styles.column]}>
              <Text style={styles.label}>Mileage</Text>
              <TextInput
                style={styles.input}
                value={mileage}
                onChangeText={setMileage}
                keyboardType="numeric"
                placeholder="30500"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Cost</Text>
            <TextInput
              style={styles.input}
              value={cost}
              onChangeText={setCost}
              keyboardType="decimal-pad"
              placeholder="89.99"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              placeholder="Add any useful details"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonInteraction]}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonInteraction,
                saving && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonText}>Save Record</Text>}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typeScale.lg,
    fontFamily: fontFamilies.heading,
  },
  group: { gap: 6 },
  label: {
    color: colors.textSecondary,
    fontSize: typeScale.sm,
    fontFamily: fontFamilies.body,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.md,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  column: {
    minWidth: 220,
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    borderColor: colors.brandAccent,
    backgroundColor: 'rgba(51, 214, 210, 0.14)',
  },
  chipText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.brandAccent,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.background,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.sm,
  },
  secondaryButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonInteraction: {
    opacity: 0.92,
  },
});
