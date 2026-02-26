import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { radii } from '../../theme/tokens';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamilies, typeScale } from '../../theme/typography';
import type { LiveOBDData, OBDSessionState } from '../../types/diagnostic';

interface Props {
  sessionState: OBDSessionState;
  data?: LiveOBDData;
}

interface PIDEntry {
  key: keyof LiveOBDData;
  label: string;
  unit: string;
  decimals?: number;
  warnHigh?: number;
  warnLow?: number;
}

const PID_ENTRIES: PIDEntry[] = [
  { key: 'rpm', label: 'Engine RPM', unit: 'rpm', warnHigh: 4000 },
  { key: 'vehicle_speed', label: 'Speed', unit: 'km/h' },
  { key: 'coolant_temp', label: 'Coolant Temp', unit: '°C', warnHigh: 105, warnLow: 60 },
  { key: 'intake_air_temp', label: 'Intake Air', unit: '°C', warnHigh: 50 },
  { key: 'throttle_position', label: 'Throttle', unit: '%' },
  { key: 'engine_load', label: 'Engine Load', unit: '%', warnHigh: 90 },
  { key: 'fuel_trim_short', label: 'Fuel Trim (S)', unit: '%', warnHigh: 10, warnLow: -10, decimals: 1 },
  { key: 'fuel_trim_long', label: 'Fuel Trim (L)', unit: '%', warnHigh: 10, warnLow: -10, decimals: 1 },
  { key: 'o2_voltage_bank1', label: 'O₂ Voltage B1', unit: 'V', decimals: 3 },
  { key: 'maf_rate', label: 'MAF Rate', unit: 'g/s', decimals: 2 },
  { key: 'timing_advance', label: 'Timing Advance', unit: '°' },
  { key: 'battery_voltage', label: 'Battery', unit: 'V', decimals: 1, warnLow: 12.5 },
];

export default function LiveDataGrid({ sessionState, data }: Props) {
  const { colors } = useTheme();

  function pidColor(entry: PIDEntry, value: number): string {
    if (entry.warnHigh !== undefined && value >= entry.warnHigh) return colors.danger;
    if (entry.warnLow !== undefined && value <= entry.warnLow) return colors.warning;
    return colors.success;
  }

  function formatVal(val: number, decimals = 0): string {
    return val.toFixed(decimals);
  }

  const styles = StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    cell: {
      width: '47%',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
    },
    cellLabel: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
    },
    cellValue: {
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.md,
    },
    cellUnit: {
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
      color: colors.textSecondary,
    },
    centeredState: {
      minHeight: 120,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      padding: 16,
    },
    stateText: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.sm,
      textAlign: 'center',
    },
    errorText: {
      color: colors.danger,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.sm,
      textAlign: 'center',
    },
  });

  if (sessionState.status === 'scanning' || sessionState.status === 'connecting') {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator color={colors.brandAccent} />
        <Text style={styles.stateText}>
          {sessionState.status === 'scanning' ? 'Scanning for adapters…' : 'Connecting to adapter…'}
        </Text>
      </View>
    );
  }

  if (sessionState.status === 'error') {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.errorText}>⚠ {sessionState.error_message || 'Connection failed'}</Text>
      </View>
    );
  }

  if (sessionState.status !== 'connected' || !data) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateText}>No live data — connect an OBD-II adapter to begin.</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {PID_ENTRIES.map((entry) => {
        const raw = data[entry.key];
        const value = typeof raw === 'number' ? raw : 0;
        const color = pidColor(entry, value);
        return (
          <View key={entry.key} style={styles.cell}>
            <Text style={styles.cellLabel}>{entry.label}</Text>
            <Text style={[styles.cellValue, { color }]}>
              {formatVal(value, entry.decimals ?? 0)}
              <Text style={styles.cellUnit}> {entry.unit}</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

