import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { decodeVIN } from '../../services/vin-decoder';
import { canAddVehicle, createVehicle } from '../../services/vehicle-service';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';

export default function NewVehicleScreen() {
  const { user } = useAuth();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vin, setVin] = useState('');
  const [mileage, setMileage] = useState('');
  const [saving, setSaving] = useState(false);
  const [decoding, setDecoding] = useState(false);

  const handleVinChange = async (text: string) => {
    const normalized = text.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    setVin(normalized);

    if (normalized.length !== 17) {
      return;
    }

    setDecoding(true);
    try {
      const decoded = await decodeVIN(normalized);
      if (decoded.make) setMake(decoded.make);
      if (decoded.model) setModel(decoded.model);
      if (decoded.year) setYear(String(decoded.year));
    } catch {
      // VIN auto-fill should never block manual entry.
    } finally {
      setDecoding(false);
    }
  };

  const handleSave = async () => {
    if (!user?.user_id) {
      Alert.alert('Authentication required', 'Please sign in to add a vehicle.');
      return;
    }

    if (!make || !model || !year) {
      Alert.alert('Missing fields', 'Make, model, and year are required.');
      return;
    }

    const parsedYear = parseInt(year, 10);
    const parsedMileage = mileage ? parseInt(mileage, 10) : undefined;
    if (Number.isNaN(parsedYear) || parsedYear < 1900 || parsedYear > new Date().getFullYear() + 1) {
      Alert.alert('Invalid year', 'Please enter a valid model year.');
      return;
    }

    if (parsedMileage !== undefined && (Number.isNaN(parsedMileage) || parsedMileage < 0)) {
      Alert.alert('Invalid mileage', 'Please enter a valid mileage amount.');
      return;
    }

    setSaving(true);
    try {
      const { canAdd, tier } = await canAddVehicle(user.user_id);
      if (!canAdd) {
        throw new Error(`Vehicle limit reached for ${tier} tier.`);
      }

      await createVehicle(user.user_id, {
        vin: vin || undefined,
        year: parsedYear,
        make: make.trim(),
        model: model.trim(),
        mileage: parsedMileage,
      });

      router.replace('/garage');
    } catch (error: any) {
      Alert.alert('Unable to save vehicle', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell routeKey="garage-new" title="Add Vehicle" subtitle="Create a new garage entry">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <Text style={styles.title}>Vehicle Profile</Text>
          <Text style={styles.subtitle}>Use a VIN to auto-fill fields, or enter details manually.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>VIN</Text>
            <View style={styles.inlineInput}>
              <TextInput
                value={vin}
                onChangeText={handleVinChange}
                style={[styles.input, styles.inlineInputField]}
                autoCapitalize="characters"
                maxLength={17}
                placeholder="17-character VIN"
                placeholderTextColor={colors.textSecondary}
              />
              {decoding && <ActivityIndicator size="small" color={colors.brandAccent} />}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Make *</Text>
            <TextInput
              value={make}
              onChangeText={setMake}
              style={styles.input}
              placeholder="Toyota"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Model *</Text>
            <TextInput
              value={model}
              onChangeText={setModel}
              style={styles.input}
              placeholder="Camry"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inlineRow}>
            <View style={[styles.inputGroup, styles.inlineColumn]}>
              <Text style={styles.label}>Year *</Text>
              <TextInput
                value={year}
                onChangeText={setYear}
                keyboardType="numeric"
                style={styles.input}
                placeholder="2024"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={[styles.inputGroup, styles.inlineColumn]}>
              <Text style={styles.label}>Mileage</Text>
              <TextInput
                value={mileage}
                onChangeText={setMileage}
                keyboardType="numeric"
                style={styles.input}
                placeholder="12500"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonInteraction,
              ]}
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
              disabled={saving}
              onPress={handleSave}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={16} color={colors.background} />
                  <Text style={styles.primaryButtonText}>Save Vehicle</Text>
                </>
              )}
            </Pressable>
          </View>
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
  },
  formCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    gap: 12,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: typeScale.xl,
    fontFamily: fontFamilies.heading,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typeScale.sm,
    fontFamily: fontFamilies.body,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
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
  inlineInput: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineInputField: {
    flex: 1,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  inlineColumn: {
    minWidth: 220,
    flex: 1,
  },
  actions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
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
    fontSize: typeScale.sm,
    fontFamily: fontFamilies.body,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.brandAccent,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: typeScale.sm,
    fontFamily: fontFamilies.heading,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonInteraction: {
    opacity: 0.92,
  },
});
