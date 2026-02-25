import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import {
  getVehicleReport,
  type VehicleReport,
} from '../../services/manual-retrieval';
import type { VehicleLookup } from '../../types/manual';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';

type LookupMode = 'vin' | 'manual';

interface RetrievedManual {
  id: string;
  report: VehicleReport;
}

export default function ManualsScreen() {
  const [lookupMode, setLookupMode] = useState<LookupMode>('vin');
  const [vinInput, setVinInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [makeInput, setMakeInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrieved, setRetrieved] = useState<RetrievedManual[]>([]);

  const handleVinLookup = useCallback(async () => {
    const vin = vinInput.trim().toUpperCase();
    if (vin.length !== 17) {
      setError('VIN must be exactly 17 characters.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const report = await getVehicleReport(vin);
      setRetrieved((prev) => [{ id: `${Date.now()}`, report }, ...prev]);
      setVinInput('');
    } catch (err: any) {
      setError(err?.message || 'Failed to lookup VIN.');
    } finally {
      setLoading(false);
    }
  }, [vinInput]);

  const handleManualLookup = useCallback(async () => {
    const year = parseInt(yearInput.trim(), 10);
    if (!year || year < 1990 || year > 2035) {
      setError('Enter a valid model year (1990-2035).');
      return;
    }

    if (!makeInput.trim() || !modelInput.trim()) {
      setError('Make and model are required.');
      return;
    }

    const vehicle: VehicleLookup = {
      year,
      make: makeInput.trim(),
      model: modelInput.trim(),
    };

    setError(null);
    setLoading(true);
    try {
      const report = await getVehicleReport(vehicle);
      setRetrieved((prev) => [{ id: `${Date.now()}`, report }, ...prev]);
      setYearInput('');
      setMakeInput('');
      setModelInput('');
    } catch (err: any) {
      setError(err?.message || 'Manual lookup failed.');
    } finally {
      setLoading(false);
    }
  }, [yearInput, makeInput, modelInput]);

  const openManual = (url?: string) => {
    if (!url) {
      Alert.alert('Manual unavailable', 'No manual URL was returned for this entry.');
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('Unable to open link', 'Please try again.'));
  };

  return (
    <AppShell routeKey="manuals" title="Manuals" subtitle="Retrieve manuals by VIN or vehicle details">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manual Retrieval</Text>
          <Text style={styles.cardSubtitle}>Choose a lookup mode and retrieve official manual links plus safety context.</Text>

          <View style={styles.modeRow}>
            {([
              { key: 'vin', label: 'VIN Lookup' },
              { key: 'manual', label: 'Year / Make / Model' },
            ] as const).map((mode) => {
              const active = lookupMode === mode.key;
              return (
                <Pressable
                  key={mode.key}
                  accessibilityRole="button"
                  onPress={() => setLookupMode(mode.key)}
                  style={({ pressed }) => [
                    styles.modeButton,
                    active && styles.modeButtonActive,
                    pressed && styles.buttonInteraction,
                  ]}
                >
                  <Text style={[styles.modeText, active && styles.modeTextActive]}>{mode.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {lookupMode === 'vin' ? (
            <View style={styles.formSection}>
              <Text style={styles.label}>VIN *</Text>
              <TextInput
                style={styles.input}
                value={vinInput}
                onChangeText={(value) => setVinInput(value.toUpperCase())}
                maxLength={17}
                autoCapitalize="characters"
                placeholder="17-character VIN"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          ) : (
            <View style={styles.formSection}>
              <Text style={styles.label}>Year *</Text>
              <TextInput
                style={styles.input}
                value={yearInput}
                onChangeText={setYearInput}
                keyboardType="numeric"
                placeholder="2024"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.label}>Make *</Text>
              <TextInput
                style={styles.input}
                value={makeInput}
                onChangeText={setMakeInput}
                placeholder="Toyota"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.label}>Model *</Text>
              <TextInput
                style={styles.input}
                value={modelInput}
                onChangeText={setModelInput}
                placeholder="Camry"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonInteraction,
              loading && styles.buttonDisabled,
            ]}
            disabled={loading}
            onPress={lookupMode === 'vin' ? handleVinLookup : handleManualLookup}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Ionicons name="search" size={16} color={colors.background} />
                <Text style={styles.primaryButtonText}>Retrieve Manual</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.resultsCard}>
          <Text style={styles.cardTitle}>Retrieved Manuals</Text>
          {retrieved.length === 0 ? (
            <Text style={styles.emptyText}>No manuals retrieved yet.</Text>
          ) : (
            retrieved.map((entry) => {
              const vehicle = entry.report.vehicle;
              const recallCount = entry.report.recalls?.count || 0;
              const safety = entry.report.safety?.ratings?.[0]?.OverallRating;

              return (
                <View key={entry.id} style={styles.resultRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
                    <Text style={styles.resultMeta}>
                      Source: {entry.report.manual.source} | Recalls: {recallCount}
                    </Text>
                    {safety ? <Text style={styles.resultMeta}>NHTSA Safety: {safety}/5</Text> : null}
                  </View>

                  <View style={styles.resultActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openManual(entry.report.manual.manual_url || undefined)}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.buttonInteraction,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>Open</Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: '/chat/[id]',
                          params: {
                            id: `manual-${entry.id}`,
                            make: vehicle.make,
                            model: vehicle.model,
                            year: vehicle.year.toString(),
                          },
                        })
                      }
                      style={({ pressed }) => [
                        styles.primaryChip,
                        pressed && styles.buttonInteraction,
                      ]}
                    >
                      <Text style={styles.primaryChipText}>Ask AI</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.md,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  modeButtonActive: {
    borderColor: colors.brandAccent,
    backgroundColor: 'rgba(51, 214, 210, 0.14)',
  },
  modeText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  modeTextActive: {
    color: colors.textPrimary,
  },
  formSection: {
    gap: 8,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
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
  errorText: {
    color: '#FCA5A5',
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.brandAccent,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: colors.background,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.sm,
  },
  resultsCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 10,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  resultRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  resultTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  resultMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
    marginTop: 2,
  },
  resultActions: {
    gap: 8,
    alignItems: 'flex-end',
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
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
  },
  primaryChip: {
    minHeight: 36,
    borderRadius: radii.full,
    backgroundColor: 'rgba(74, 163, 255, 0.22)',
    borderWidth: 1,
    borderColor: colors.actionAccent,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryChipText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonInteraction: {
    opacity: 0.92,
  },
});
