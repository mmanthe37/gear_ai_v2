import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import { Button, ErrorBanner } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { decodeVIN } from '../../services/vin-decoder';
import { canAddVehicle, createVehicle } from '../../services/vehicle-service';
import { sp, touchMinHeight } from '../../theme/spacing';
import { radii } from '../../theme/tokens';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamilies, typeScale } from '../../theme/typography';

export default function NewVehicleScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vin, setVin] = useState('');
  const [mileage, setMileage] = useState('');
  const [nickname, setNickname] = useState('');
  const [color, setColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [saving, setSaving] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);

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

  const notifyError = (message: string, title: string = 'Unable to save vehicle') => {
    console.error(`[Garage] ${title}: ${message}`);
    setErrorMessage(message);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    if (Platform.OS !== 'web') {
      Alert.alert(title, message);
    }
  };

  const handleSave = async () => {
    setErrorMessage('');

    if (!user?.user_id) {
      notifyError('Please sign in to add a vehicle.', 'Authentication required');
      return;
    }

    if (!make || !model || !year) {
      notifyError('Make, model, and year are required.', 'Missing fields');
      return;
    }

    if (vin && vin.length !== 17) {
      notifyError('VIN must be exactly 17 characters, or leave it blank.', 'Invalid VIN');
      return;
    }

    const parsedYear = parseInt(year, 10);
    const parsedMileage = mileage ? parseInt(mileage, 10) : undefined;
    if (Number.isNaN(parsedYear) || parsedYear < 1900 || parsedYear > new Date().getFullYear() + 1) {
      notifyError('Please enter a valid model year.', 'Invalid year');
      return;
    }

    if (parsedMileage !== undefined && (Number.isNaN(parsedMileage) || parsedMileage < 0)) {
      notifyError('Please enter a valid mileage amount.', 'Invalid mileage');
      return;
    }

    setSaving(true);
    try {
      const { canAdd, tier } = await canAddVehicle(user.user_id);
      if (!canAdd) {
        throw new Error(`Vehicle limit reached for ${tier} tier. Upgrade your plan to add more vehicles.`);
      }

      const vinToSave = vin.length === 17 ? vin : undefined;

      await createVehicle(user.user_id, {
        vin: vinToSave,
        year: parsedYear,
        make: make.trim(),
        model: model.trim(),
        mileage: parsedMileage,
        nickname: nickname.trim() || undefined,
        color: color.trim() || undefined,
        license_plate: licensePlate.trim() || undefined,
      });

      router.replace('/garage');
    } catch (error: any) {
      console.error('[Garage] Save vehicle failed:', error);
      notifyError(error?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      padding: sp[4],
    },
    formCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: sp[4],
      gap: sp[3],
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
      marginBottom: sp[1],
    },
    inputGroup: {
      gap: sp[2],
    },
    label: {
      color: colors.textSecondary,
      fontSize: typeScale.sm,
      fontFamily: fontFamilies.body,
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
    inlineInput: {
      minHeight: touchMinHeight,
      flexDirection: 'row',
      alignItems: 'center',
      gap: sp[3],
    },
    inlineInputField: {
      flex: 1,
    },
    inlineRow: {
      flexDirection: 'row',
      gap: sp[3],
      flexWrap: 'wrap',
    },
    inlineColumn: {
      minWidth: 220,
      flex: 1,
    },
    actions: {
      marginTop: sp[3],
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: sp[3],
      flexWrap: 'wrap',
    },
  });

  return (
    <AppShell routeKey="garage-new" title="Add Vehicle" subtitle="Create a new garage entry">
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <Text style={styles.title}>Vehicle Profile</Text>
          <Text style={styles.subtitle}>Use a VIN to auto-fill fields, or enter details manually.</Text>

          {!!errorMessage && (
            <ErrorBanner
              message={errorMessage}
              onDismiss={() => setErrorMessage('')}
            />
          )}

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
                accessibilityLabel="Vehicle Identification Number"
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
              accessibilityLabel="Vehicle make"
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
              accessibilityLabel="Vehicle model"
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
                accessibilityLabel="Model year"
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
                accessibilityLabel="Current mileage"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nickname</Text>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              style={styles.input}
              placeholder='e.g. "Daily Driver", "Weekend Warrior"'
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Vehicle nickname"
            />
          </View>

          <View style={styles.inlineRow}>
            <View style={[styles.inputGroup, styles.inlineColumn]}>
              <Text style={styles.label}>Color</Text>
              <TextInput
                value={color}
                onChangeText={setColor}
                style={styles.input}
                placeholder="e.g. Pearl White"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Vehicle color"
              />
            </View>
            <View style={[styles.inputGroup, styles.inlineColumn]}>
              <Text style={styles.label}>License Plate</Text>
              <TextInput
                value={licensePlate}
                onChangeText={setLicensePlate}
                style={styles.input}
                autoCapitalize="characters"
                placeholder="e.g. ABC-1234"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="License plate number"
              />
            </View>
          </View>

          {!!errorMessage && (
            <ErrorBanner
              message={errorMessage}
              onDismiss={() => setErrorMessage('')}
            />
          )}

          <View style={styles.actions}>
            <Button
              variant="secondary"
              title="Cancel"
              onPress={() => router.back()}
              accessibilityHint="Go back without saving"
            />

            <Button
              variant="primary"
              title="Save Vehicle"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              accessibilityHint="Save the vehicle to your garage"
            />
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}
