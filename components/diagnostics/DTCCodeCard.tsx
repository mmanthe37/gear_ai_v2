import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import GearActionIcon from '../branding/GearActionIcon';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';
import type { DiagnosticCode, DTCAnalysis } from '../../types/diagnostic';

interface Props {
  code: DiagnosticCode;
  onAnalyze: (code: DiagnosticCode) => Promise<DTCAnalysis | null>;
  onResolve: (diagnosticId: string) => Promise<void>;
  analysis?: DTCAnalysis | null;
}

const severityColor: Record<DiagnosticCode['severity'], string> = {
  critical: '#DC2626',
  high: colors.danger,
  medium: colors.warning,
  low: colors.success,
};

const statusColor: Record<DiagnosticCode['status'], string> = {
  active: colors.danger,
  pending: colors.warning,
  resolved: colors.success,
  false_positive: colors.textSecondary,
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function DTCCodeCard({ code, onAnalyze, onResolve, analysis: propAnalysis }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [analysis, setAnalysis] = useState<DTCAnalysis | null>(propAnalysis ?? null);

  async function handleAnalyze() {
    if (analysis) { setExpanded(true); return; }
    setAnalyzing(true);
    try {
      const res = await onAnalyze(code);
      if (res) setAnalysis(res);
    } finally {
      setAnalyzing(false);
      setExpanded(true);
    }
  }

  async function handleResolve() {
    setResolving(true);
    try {
      await onResolve(code.diagnostic_id);
    } finally {
      setResolving(false);
    }
  }

  const accent = severityColor[code.severity];

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      {/* Header row */}
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.codeText, { color: accent }]}>{code.code}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { borderColor: accent }]}>
              <Text style={[styles.badgeText, { color: accent }]}>{code.severity}</Text>
            </View>
            <View style={[styles.badge, { borderColor: statusColor[code.status] }]}>
              <Text style={[styles.badgeText, { color: statusColor[code.status] }]}>{code.status}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      <Text style={styles.description}>{code.description}</Text>

      <Text style={styles.meta}>
        {code.code_type === 'P' ? 'Powertrain' : code.code_type === 'C' ? 'Chassis' : code.code_type === 'B' ? 'Body' : 'Network'}
        {code.detected_at ? ` · Detected ${formatDate(code.detected_at)}` : ''}
        {code.mileage_at_detection ? ` · ${code.mileage_at_detection.toLocaleString()} mi` : ''}
      </Text>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.expandedBody}>
          {/* Freeze frame */}
          {code.freeze_frame_data && Object.keys(code.freeze_frame_data).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Freeze Frame</Text>
              <View style={styles.ffGrid}>
                {Object.entries(code.freeze_frame_data).filter(([, v]) => v != null).map(([k, v]) => (
                  <View key={k} style={styles.ffCell}>
                    <Text style={styles.ffKey}>{k.replace(/_/g, ' ')}</Text>
                    <Text style={styles.ffVal}>{String(v)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* AI Analysis */}
          {analysis ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>AI Interpretation</Text>
              {analysis.ai_plain_english && (
                <Text style={styles.aiText}>{analysis.ai_plain_english}</Text>
              )}

              {(analysis.probable_causes_ranked?.length ?? 0) > 0 && (
                <View style={styles.subsection}>
                  <Text style={styles.subLabel}>Probable Causes</Text>
                  {analysis.probable_causes_ranked!.map((c, i) => (
                    <View key={i} style={styles.causeRow}>
                      <View style={[styles.likelihoodDot, {
                        backgroundColor: c.likelihood === 'high' ? colors.danger : c.likelihood === 'medium' ? colors.warning : colors.success,
                      }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.causeName}>{c.cause}</Text>
                        <Text style={styles.causeExp}>{c.explanation}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.costRow}>
                <View style={styles.costItem}>
                  <Text style={styles.costLabel}>Est. Cost</Text>
                  <Text style={styles.costValue}>${analysis.estimated_cost_min}–${analysis.estimated_cost_max}</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costLabel}>Difficulty</Text>
                  <Text style={styles.costValue}>{analysis.repair_difficulty}</Text>
                </View>
                {analysis.diy_vs_shop && (
                  <View style={styles.costItem}>
                    <Text style={styles.costLabel}>Recommendation</Text>
                    <Text style={[styles.costValue, {
                      color: analysis.diy_vs_shop === 'diy' ? colors.success : analysis.diy_vs_shop === 'shop' ? colors.warning : colors.textPrimary,
                    }]}>
                      {analysis.diy_vs_shop === 'diy' ? 'DIY Possible' : analysis.diy_vs_shop === 'shop' ? 'Take to Shop' : 'Either'}
                    </Text>
                  </View>
                )}
              </View>

              {analysis.diy_vs_shop_reasoning && (
                <Text style={styles.aiText}>{analysis.diy_vs_shop_reasoning}</Text>
              )}
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.analyzeBtn, pressed && { opacity: 0.85 }]}
              onPress={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <View style={styles.analyzeBtnContent}>
                  <GearActionIcon size="sm" />
                  <Text style={styles.analyzeBtnText}>AI Analyze This Code</Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Actions */}
          {code.status === 'active' && (
            <Pressable
              style={({ pressed }) => [styles.resolveBtn, pressed && { opacity: 0.85 }]}
              onPress={handleResolve}
              disabled={resolving}
            >
              {resolving ? (
                <ActivityIndicator color={colors.textPrimary} size="small" />
              ) : (
                <Text style={styles.resolveBtnText}>Mark as Resolved</Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderRadius: radii.md,
    padding: 12,
    gap: 6,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLeft: { flex: 1, gap: 6 },
  codeText: { fontFamily: fontFamilies.heading, fontSize: typeScale.xl },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: fontFamilies.body, fontSize: 10, textTransform: 'uppercase' },
  chevron: { color: colors.textSecondary, fontSize: 10, marginTop: 4 },
  description: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  meta: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  expandedBody: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 6, gap: 14 },
  section: { gap: 8 },
  sectionLabel: { color: colors.brandAccent, fontFamily: fontFamilies.heading, fontSize: typeScale.xs, textTransform: 'uppercase', letterSpacing: 1 },
  ffGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ffCell: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 4, minWidth: '30%' },
  ffKey: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 10, textTransform: 'uppercase' },
  ffVal: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  aiText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, lineHeight: 20 },
  subsection: { gap: 8 },
  subLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  causeRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  likelihoodDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  causeName: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  causeExp: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, lineHeight: 16 },
  costRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  costItem: { flex: 1, minWidth: '28%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 8, gap: 2 },
  costLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 10, textTransform: 'uppercase' },
  costValue: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  analyzeBtn: { backgroundColor: colors.brandAccent, borderRadius: radii.md, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  analyzeBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzeBtnText: { color: '#000', fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  resolveBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  resolveBtnText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
});
