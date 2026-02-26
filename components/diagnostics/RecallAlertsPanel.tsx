import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import GearActionIcon from '../branding/GearActionIcon';
import { radii } from '../../theme/tokens';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamilies, typeScale } from '../../theme/typography';
import type { RecallAlert, TSBResult } from '../../types/diagnostic';

interface Props {
  recalls: RecallAlert[];
  tsbs: TSBResult[];
  loading?: boolean;
  onAcknowledge: (campaignId: string) => Promise<void>;
}

export default function RecallAlertsPanel({ recalls, tsbs, loading, onAcknowledge }: Props) {
  const { colors } = useTheme();
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const unacknowledged = recalls.filter((r) => !r.acknowledged);
  const acknowledged = recalls.filter((r) => r.acknowledged);

  async function handleAck(campaignId: string) {
    setAcknowledging(campaignId);
    try {
      await onAcknowledge(campaignId);
    } finally {
      setAcknowledging(null);
    }
  }

  const styles = StyleSheet.create({
    container: { gap: 16 },
    section: { gap: 8 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
    countBadge: { backgroundColor: colors.danger, borderRadius: radii.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    countText: { color: '#fff', fontFamily: fontFamilies.heading, fontSize: 10 },
    centeredState: { minHeight: 100, justifyContent: 'center', alignItems: 'center', gap: 8 },
    stateText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
    emptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
    emptyIcon: { fontSize: 32, color: colors.success },
    emptyTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md },
    emptySubtitle: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
    recallCard: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    recallAcknowledged: { borderColor: colors.border, opacity: 0.7 },
    recallRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    checkmark: { color: colors.success, fontSize: 16, flexShrink: 0 },
    recallComponent: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, flex: 1 },
    recallCampaign: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },
    tsbCard: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 12, gap: 4 },
    tsbSubject: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
    tsbMeta: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    tsbSummary: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, lineHeight: 16, marginTop: 2 },
  });

  if (loading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator color={colors.brandAccent} />
        <Text style={styles.stateText}>Checking NHTSA recall database…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Active Recalls */}
      {unacknowledged.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Recalls</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{unacknowledged.length}</Text>
            </View>
          </View>
          {unacknowledged.map((recall) => (
            <RecallCard
              key={recall.nhtsa_campaign}
              recall={recall}
              expanded={expanded === recall.nhtsa_campaign}
              onToggle={() => setExpanded(expanded === recall.nhtsa_campaign ? null : recall.nhtsa_campaign)}
              onAcknowledge={() => handleAck(recall.nhtsa_campaign)}
              acknowledging={acknowledging === recall.nhtsa_campaign}
            />
          ))}
        </View>
      )}

      {recalls.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>No Recalls Found</Text>
          <Text style={styles.emptySubtitle}>No NHTSA recalls on record for this vehicle.</Text>
        </View>
      )}

      {/* TSBs */}
      {tsbs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technical Service Bulletins</Text>
          {tsbs.slice(0, 5).map((tsb) => (
            <View key={tsb.tsb_id} style={styles.tsbCard}>
              <Text style={styles.tsbSubject}>{tsb.subject}</Text>
              {tsb.issue_date && (
                <Text style={styles.tsbMeta}>{tsb.make} {tsb.model} {tsb.year} · {tsb.issue_date}</Text>
              )}
              {tsb.summary ? (
                <Text style={styles.tsbSummary} numberOfLines={3}>{tsb.summary}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Previously Acknowledged */}
      {acknowledged.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Acknowledged ({acknowledged.length})
          </Text>
          {acknowledged.map((recall) => (
            <View key={recall.nhtsa_campaign} style={[styles.recallCard, styles.recallAcknowledged]}>
              <View style={styles.recallRow}>
                <Text style={styles.checkmark}>✓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recallComponent, { color: colors.textSecondary }]}>
                    {recall.component}
                  </Text>
                  <Text style={styles.recallCampaign}>{recall.nhtsa_campaign}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface RecallCardProps {
  recall: RecallAlert;
  expanded: boolean;
  onToggle: () => void;
  onAcknowledge: () => void;
  acknowledging: boolean;
}

function RecallCard({ recall, expanded, onToggle, onAcknowledge, acknowledging }: RecallCardProps) {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    recallCard: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.3)',
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    recallHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    recallHeaderLeft: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginTop: 4, flexShrink: 0 },
    recallComponent: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, flex: 1 },
    recallCampaign: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },
    chevron: { color: colors.textSecondary, fontSize: 10 },
    recallBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: 12, gap: 10 },
    recallField: { gap: 2 },
    fieldLabel: { color: colors.brandAccent, fontFamily: fontFamilies.heading, fontSize: typeScale.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldValue: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, lineHeight: 18 },
    recallActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    actionBtn: { flex: 1, minHeight: 36, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
    actionLink: { borderWidth: 1, borderColor: colors.brandAccent },
    actionLinkText: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    actionAck: { backgroundColor: colors.brandAccent },
    actionAckContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionAckText: { color: '#000', fontFamily: fontFamilies.heading, fontSize: typeScale.xs },
  });
  return (
    <View style={styles.recallCard}>
      <Pressable onPress={onToggle} style={styles.recallHeader}>
        <View style={styles.recallHeaderLeft}>
          <View style={styles.alertDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.recallComponent}>{recall.component}</Text>
            <Text style={styles.recallCampaign}>Campaign: {recall.nhtsa_campaign}</Text>
          </View>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.recallBody}>
          <View style={styles.recallField}>
            <Text style={styles.fieldLabel}>Summary</Text>
            <Text style={styles.fieldValue}>{recall.summary}</Text>
          </View>
          {recall.consequence ? (
            <View style={styles.recallField}>
              <Text style={styles.fieldLabel}>Consequence</Text>
              <Text style={[styles.fieldValue, { color: colors.danger }]}>{recall.consequence}</Text>
            </View>
          ) : null}
          <View style={styles.recallField}>
            <Text style={styles.fieldLabel}>Remedy</Text>
            <Text style={styles.fieldValue}>{recall.remedy}</Text>
          </View>
          <View style={styles.recallActions}>
            {recall.remedy_url && (
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionLink, pressed && { opacity: 0.75 }]}
                onPress={() => recall.remedy_url && Linking.openURL(recall.remedy_url)}
              >
                <Text style={styles.actionLinkText}>View on NHTSA ↗</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.actionAck, pressed && { opacity: 0.85 }]}
              onPress={onAcknowledge}
              disabled={acknowledging}
            >
              {acknowledging ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <View style={styles.actionAckContent}>
                  <GearActionIcon size="sm" />
                  <Text style={styles.actionAckText}>Mark Acknowledged</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

