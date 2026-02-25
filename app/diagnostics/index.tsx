import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppShell from '../../components/layout/AppShell';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';

interface DiagnosticCode {
  id: string;
  code: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  vehicle: string;
  dateDetected: string;
}

const SAMPLE_DIAGNOSTICS: DiagnosticCode[] = [
  {
    id: '1',
    code: 'P0420',
    description: 'Catalyst System Efficiency Below Threshold',
    severity: 'medium',
    vehicle: '2023 Toyota Camry',
    dateDetected: 'Dec 10, 2024',
  },
  {
    id: '2',
    code: 'P0171',
    description: 'System Too Lean (Bank 1)',
    severity: 'high',
    vehicle: '2022 Honda Civic',
    dateDetected: 'Dec 8, 2024',
  },
  {
    id: '3',
    code: 'B1342',
    description: 'ECM/PCM Processor',
    severity: 'low',
    vehicle: '2023 Toyota Camry',
    dateDetected: 'Dec 5, 2024',
  },
];

const severityColor: Record<DiagnosticCode['severity'], string> = {
  high: colors.danger,
  medium: colors.warning,
  low: colors.actionAccent,
};

export default function DiagnosticsScreen() {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return SAMPLE_DIAGNOSTICS;
    return SAMPLE_DIAGNOSTICS.filter((item) => item.severity === filter);
  }, [filter]);

  return (
    <AppShell routeKey="diagnostics" title="Diagnostics" subtitle="Monitor fault codes and vehicle health status">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.cardTitle}>Diagnostic Trouble Codes</Text>
          <Text style={styles.cardSubtitle}>Phase 2 data integration pending. Current values are sample data.</Text>

          <View style={styles.filterRow}>
            {(['all', 'high', 'medium', 'low'] as const).map((key) => {
              const active = filter === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  onPress={() => setFilter(key)}
                  style={({ pressed }) => [
                    styles.filterButton,
                    active && styles.filterButtonActive,
                    pressed && styles.buttonInteraction,
                  ]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {key[0].toUpperCase() + key.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.listWrap}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={36} color={colors.success} />
              <Text style={styles.emptyTitle}>No codes for selected filter</Text>
            </View>
          ) : (
            filtered.map((item) => (
              <View key={item.id} style={styles.codeCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.codeValue}>{item.code}</Text>
                  <Text style={styles.codeDescription}>{item.description}</Text>
                  <Text style={styles.codeMeta}>{item.vehicle} | {item.dateDetected}</Text>
                </View>
                <View style={[styles.severityBadge, { borderColor: severityColor[item.severity] }]}>
                  <Text style={[styles.severityText, { color: severityColor[item.severity] }]}>{item.severity}</Text>
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
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  headerCard: {
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
    fontSize: typeScale.lg,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 14,
    justifyContent: 'center',
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
  listWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 10,
  },
  emptyState: {
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  codeCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  codeValue: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.lg,
  },
  codeDescription: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
    marginTop: 2,
  },
  codeMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
    marginTop: 4,
  },
  severityBadge: {
    minWidth: 70,
    minHeight: 30,
    borderRadius: radii.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  severityText: {
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
    textTransform: 'uppercase',
  },
  buttonInteraction: {
    opacity: 0.92,
  },
});
