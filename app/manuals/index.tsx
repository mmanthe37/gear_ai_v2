import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import GearActionIcon from '../../components/branding/GearActionIcon';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import {
  getVehicleReport,
  type VehicleReport,
  type RetrievalProgressStep,
} from '../../services/manual-retrieval';
import { getUserVehicles } from '../../services/vehicle-service';
import type { VehicleLookup } from '../../types/manual';
import type { Vehicle } from '../../types/vehicle';
import { sp, touchMinHeight, pressedOpacity } from '../../theme/spacing';
import { typeScale, fontFamilies, fontWeights, letterSpacings } from '../../theme/typography';
import { elevation, radii } from '../../theme/tokens';
import { useTheme } from '../../contexts/ThemeContext';

type LookupMode = 'vin' | 'manual';

interface RetrievedManual {
  id: string;
  report: VehicleReport;
}

const PROGRESS_LABELS: Record<RetrievalProgressStep, string> = {
  checking_cache: 'Checking local cache...',
  checking_indexed: 'Checking manual library...',
  trying_oem: 'Checking manufacturer site...',
  asking_ai: 'Asking AI to locate PDF...',
  verifying_url: 'Verifying PDF URL...',
  downloading_pdf: 'Downloading PDF...',
  uploading: 'Uploading to secure storage...',
  processing_rag: 'Processing manual for AI search...',
  searching_aggregators: 'Searching manual databases...',
  done: 'Complete',
  fallback: 'No direct PDF found',
};

export default function ManualsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [lookupMode, setLookupMode] = useState<LookupMode>('vin');
  const [vinInput, setVinInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [makeInput, setMakeInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [retrieved, setRetrieved] = useState<RetrievedManual[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [initializedFromVehicle, setInitializedFromVehicle] = useState(false);
  const userId = user?.user_id;

  const routeVehicleId = typeof params.vehicleId === 'string' ? params.vehicleId : '';
  const defaultVehicleId = typeof user?.preferences?.default_vehicle_id === 'string'
    ? user.preferences.default_vehicle_id
    : '';

  useEffect(() => {
    if (!userId) {
      setVehicles([]);
      return;
    }

    let mounted = true;
    getUserVehicles(userId)
      .then((rows) => {
        if (mounted) setVehicles(rows);
      })
      .catch((err) => {
        console.warn('[Manuals] Failed to load vehicles:', err);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  const suggestedVehicle = useMemo(() => {
    if (!vehicles.length) return null;
    return (
      vehicles.find((v) => v.vehicle_id === selectedVehicleId) ||
      vehicles.find((v) => v.vehicle_id === routeVehicleId) ||
      vehicles.find((v) => v.vehicle_id === defaultVehicleId) ||
      vehicles[0]
    );
  }, [defaultVehicleId, routeVehicleId, selectedVehicleId, vehicles]);

  const applyVehicleSelection = useCallback((vehicle: Vehicle) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    if (vehicle.vin && vehicle.vin.length === 17) {
      setLookupMode('vin');
      setVinInput(vehicle.vin.toUpperCase());
    } else {
      setLookupMode('manual');
    }
    setYearInput(vehicle.year.toString());
    setMakeInput(vehicle.make);
    setModelInput(vehicle.model);
    setError(null);
  }, []);

  useEffect(() => {
    const paramVehicleId = typeof params.vehicleId === 'string' ? params.vehicleId : '';
    const paramVin = typeof params.vin === 'string' ? params.vin.trim().toUpperCase() : '';
    const paramYear = typeof params.year === 'string' ? params.year.trim() : '';
    const paramMake = typeof params.make === 'string' ? params.make.trim() : '';
    const paramModel = typeof params.model === 'string' ? params.model.trim() : '';

    if (!paramVehicleId && !paramVin && !paramYear && !paramMake && !paramModel) {
      return;
    }

    if (paramVehicleId) {
      setSelectedVehicleId(paramVehicleId);
    }

    if (paramVin.length === 17) {
      setLookupMode('vin');
      setVinInput(paramVin);
    } else if (paramYear && paramMake && paramModel) {
      setLookupMode('manual');
      setYearInput(paramYear);
      setMakeInput(paramMake);
      setModelInput(paramModel);
    }

    setInitializedFromVehicle(true);
  }, [params.make, params.model, params.vehicleId, params.vin, params.year]);

  useEffect(() => {
    if (initializedFromVehicle || !suggestedVehicle) return;
    applyVehicleSelection(suggestedVehicle);
    setInitializedFromVehicle(true);
  }, [applyVehicleSelection, initializedFromVehicle, suggestedVehicle]);

  const findVehicleForVin = useCallback((vin: string): Vehicle | undefined => {
    const normalizedVin = vin.toUpperCase();
    return (
      vehicles.find((v) => (v.vin || '').toUpperCase() === normalizedVin) ||
      vehicles.find((v) => v.vehicle_id === selectedVehicleId)
    );
  }, [selectedVehicleId, vehicles]);

  const findVehicleForLookup = useCallback((lookup: VehicleLookup): Vehicle | undefined => {
    const normalizedMake = lookup.make.trim().toLowerCase();
    const normalizedModel = lookup.model.trim().toLowerCase();
    return (
      vehicles.find((v) => v.vehicle_id === selectedVehicleId) ||
      vehicles.find(
        (v) =>
          v.year === lookup.year &&
          v.make.trim().toLowerCase() === normalizedMake &&
          v.model.trim().toLowerCase() === normalizedModel
      )
    );
  }, [selectedVehicleId, vehicles]);

  const handleVinLookup = useCallback(async () => {
    const vin = vinInput.trim().toUpperCase();
    if (vin.length !== 17) {
      setError('VIN must be exactly 17 characters.');
      return;
    }

    setError(null);
    setProgressStep('');
    setLoading(true);
    try {
      const matchedVehicle = findVehicleForVin(vin);
      const report = await getVehicleReport(
        vin,
        (step, detail) => {
          setProgressStep(detail || PROGRESS_LABELS[step] || step);
        },
        userId
          ? { userId, vehicleId: matchedVehicle?.vehicle_id }
          : undefined
      );
      setRetrieved((prev) => [{ id: `${Date.now()}`, report }, ...prev]);
    } catch (err: any) {
      setError(err?.message || 'Failed to lookup VIN.');
    } finally {
      setLoading(false);
      setProgressStep('');
    }
  }, [findVehicleForVin, userId, vinInput]);

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
    setProgressStep('');
    setLoading(true);
    try {
      const matchedVehicle = findVehicleForLookup(vehicle);
      const report = await getVehicleReport(
        vehicle,
        (step, detail) => {
          setProgressStep(detail || PROGRESS_LABELS[step] || step);
        },
        userId
          ? { userId, vehicleId: matchedVehicle?.vehicle_id }
          : undefined
      );
      setRetrieved((prev) => [{ id: `${Date.now()}`, report }, ...prev]);
    } catch (err: any) {
      setError(err?.message || 'Manual lookup failed.');
    } finally {
      setLoading(false);
      setProgressStep('');
    }
  }, [findVehicleForLookup, makeInput, modelInput, userId, yearInput]);

  const openManual = (url?: string) => {
    if (!url) {
      Alert.alert('Manual unavailable', 'No manual URL was returned for this entry.');
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('Unable to open link', 'Please try again.'));
  };

  const styles = StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: sp[4], gap: sp[3] },
    pressedState: { opacity: pressedOpacity },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      padding: sp[4],
      gap: sp[3],
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
    suggestionCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceAlt,
      padding: sp[3],
      gap: sp[2],
    },
    suggestionTitle: {
      color: colors.textPrimary,
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.sm,
    },
    suggestionSubtitle: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
    },
    vehiclePillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sp[2],
    },
    vehiclePill: {
      minHeight: 32,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.full,
      backgroundColor: colors.surface,
      paddingHorizontal: sp[3],
      justifyContent: 'center',
      alignItems: 'center',
    },
    vehiclePillActive: {
      borderColor: colors.brandAccent,
      backgroundColor: colors.accentTintStrong,
    },
    vehiclePillText: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
    },
    vehiclePillTextActive: {
      color: colors.textPrimary,
    },
    modeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sp[2],
    },
    modeButton: {
      minHeight: touchMinHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: sp[4],
      justifyContent: 'center',
    },
    modeButtonActive: {
      borderColor: colors.brandAccent,
      backgroundColor: colors.accentTint,
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
      gap: sp[2],
    },
    label: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.sm,
    },
    input: {
      minHeight: touchMinHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceAlt,
      color: colors.textPrimary,
      paddingHorizontal: sp[3],
      fontFamily: fontFamilies.body,
      fontSize: typeScale.md,
    },
    errorText: {
      color: colors.danger,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.sm,
    },
    primaryButton: {
      minHeight: touchMinHeight,
      borderRadius: radii.md,
      backgroundColor: colors.brandAccent,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: sp[2],
      paddingHorizontal: sp[4],
    },
    primaryButtonText: {
      color: colors.background,
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.sm,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sp[2],
      flex: 1,
      justifyContent: 'center',
    },
    progressText: {
      color: colors.background,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
      flexShrink: 1,
    },
    resultsCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      padding: sp[3],
      gap: sp[3],
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
      paddingHorizontal: sp[3],
      paddingVertical: sp[3],
      flexDirection: 'row',
      gap: sp[3],
      alignItems: 'center',
    },
    resultFlex: { flex: 1 },
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
      gap: sp[2],
      alignItems: 'flex-end',
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
    },
    searchButton: {
      minHeight: 36,
      borderWidth: 1,
      borderColor: colors.textSecondary,
      borderRadius: radii.full,
      backgroundColor: 'transparent',
      paddingHorizontal: sp[3],
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
      backgroundColor: colors.accentTintStrong,
      borderWidth: 1,
      borderColor: colors.actionAccent,
      paddingHorizontal: sp[3],
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: sp[2],
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
      opacity: pressedOpacity,
    },
  });

  return (
    <AppShell routeKey="manuals" title="Manuals" subtitle="Retrieve manuals by VIN or vehicle details">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manual Retrieval</Text>
          <Text style={styles.cardSubtitle}>Choose a lookup mode and retrieve official manual links plus safety context.</Text>

          {suggestedVehicle ? (
            <View style={styles.suggestionCard}>
              <Text style={styles.suggestionTitle}>Suggested vehicle</Text>
              <Text style={styles.suggestionSubtitle}>
                {suggestedVehicle.year} {suggestedVehicle.make} {suggestedVehicle.model}
                {suggestedVehicle.vin ? ` • VIN ending ${suggestedVehicle.vin.slice(-6)}` : ''}
              </Text>

              <View style={styles.vehiclePillRow}>
                {vehicles.map((vehicle) => {
                  const active = vehicle.vehicle_id === suggestedVehicle.vehicle_id;
                  const label = vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
                  return (
                    <Pressable
                      key={vehicle.vehicle_id}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${label}`}
                      onPress={() => applyVehicleSelection(vehicle)}
                      style={({ pressed }) => [
                        styles.vehiclePill,
                        active && styles.vehiclePillActive,
                        pressed && styles.pressedState,
                      ]}
                    >
                      <Text style={[styles.vehiclePillText, active && styles.vehiclePillTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

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
                  accessibilityLabel={`${mode.label} lookup mode`}
                  onPress={() => setLookupMode(mode.key)}
                  style={({ pressed }) => [
                    styles.modeButton,
                    active && styles.modeButtonActive,
                    pressed && styles.pressedState,
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
            accessibilityLabel={lookupMode === 'vin' ? 'Look up manual by VIN' : 'Look up manual by vehicle details'}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressedState,
              loading && styles.buttonDisabled,
            ]}
            disabled={loading}
            onPress={lookupMode === 'vin' ? handleVinLookup : handleManualLookup}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.background} size="small" />
                {!!progressStep && (
                  <Text style={styles.progressText} numberOfLines={1}>{progressStep}</Text>
                )}
              </View>
            ) : (
              <>
                <GearActionIcon size="sm" />
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
                  <View style={styles.resultFlex}>
                    <Text style={styles.resultTitle}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
                    <Text style={styles.resultMeta}>
                      {entry.report.manual.source === 'web_search'
                        ? 'No direct PDF found — clicking will search the web'
                        : `Source: ${entry.report.manual.source}`} | Recalls: {recallCount}
                    </Text>
                    {safety ? <Text style={styles.resultMeta}>NHTSA Safety: {safety}/5</Text> : null}
                  </View>

                  <View style={styles.resultActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={entry.report.manual.source === 'web_search' ? 'Search web for manual' : 'Open PDF manual'}
                      onPress={() => openManual(entry.report.manual.manual_url || undefined)}
                      style={({ pressed }) => [
                        entry.report.manual.source === 'web_search'
                          ? styles.searchButton
                          : styles.secondaryButton,
                        pressed && styles.pressedState,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {entry.report.manual.source === 'web_search' ? 'Search Web' : 'Open PDF'}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ask AI about ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
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
                        pressed && styles.pressedState,
                      ]}
                    >
                      <GearActionIcon size="xs" />
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
