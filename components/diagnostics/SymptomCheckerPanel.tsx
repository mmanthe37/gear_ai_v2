import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import GearActionIcon from '../branding/GearActionIcon';
import { radii } from '../../theme/tokens';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamilies, typeScale } from '../../theme/typography';
import type { SymptomCheck } from '../../types/diagnostic';

interface Props {
  onSubmit: (symptomText: string) => Promise<SymptomCheck | null>;
  history?: SymptomCheck[];
}

export default function SymptomCheckerPanel({ onSubmit, history = [] }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SymptomCheck | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const urgencyColor: Record<string, string> = {
    low: colors.success,
    medium: colors.warning,
    high: '#F97316',
    critical: colors.danger,
  };

  const examplePrompts = [
    'Car shakes when braking above 60 mph',
    'Engine stutters on cold start then idles rough',
    'Grinding noise from front left when turning',
    'Heater not blowing hot air after warm-up',
  ];

  async function handleSubmit() {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await onSubmit(text.trim());
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  const styles = StyleSheet.create({
    container: { gap: 12 },
    heading: {
      color: colors.textPrimary,
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.lg,
    },
    sub: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.sm,
    },
    chipRow: { marginHorizontal: -4 },
    chipContent: { gap: 8, paddingHorizontal: 4 },
    chip: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.full,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipText: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
    },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: 12,
      color: colors.textPrimary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.sm,
      minHeight: 80,
    },
    submitBtn: {
      backgroundColor: colors.brandAccent,
      borderRadius: radii.md,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitDisabled: { opacity: 0.5 },
    submitContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    submitText: {
      color: '#000',
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.sm,
    },
    resultCard: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: 14,
      gap: 12,
    },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    resultTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md },
    urgencyBadge: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 3 },
    urgencyText: { fontFamily: fontFamilies.body, fontSize: typeScale.xs, textTransform: 'uppercase' },
    analysisText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, lineHeight: 20 },
    section: { gap: 6 },
    sectionLabel: { color: colors.brandAccent, fontFamily: fontFamilies.heading, fontSize: typeScale.xs, textTransform: 'uppercase', letterSpacing: 1 },
    codeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    codePill: { backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.brandAccent, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4 },
    codePillText: { color: colors.brandAccent, fontFamily: fontFamilies.heading, fontSize: typeScale.xs },
    bulletItem: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, lineHeight: 20 },
    flowStep: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 10, gap: 6 },
    flowStepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandAccent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    stepNumText: { color: '#000', fontFamily: fontFamilies.heading, fontSize: 11 },
    flowInstruction: { flex: 1, color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, lineHeight: 18 },
    flowDetail: { paddingLeft: 32, gap: 4 },
    flowCheck: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    flowYes: { color: colors.success, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    flowNo: { color: colors.warning, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Describe a Symptom</Text>
      <Text style={styles.sub}>
        Describe what you're experiencing in plain language and AI will analyze it.
      </Text>

      {/* Example chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipContent}>
        {examplePrompts.map((p) => (
          <Pressable
            key={p}
            style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
            onPress={() => setText(p)}
          >
            <Text style={styles.chipText}>{p}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Input */}
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder='e.g. "car vibrates at highway speeds"'
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <Pressable
        style={({ pressed }) => [styles.submitBtn, loading && styles.submitDisabled, pressed && { opacity: 0.85 }]}
        onPress={handleSubmit}
        disabled={loading || !text.trim()}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <View style={styles.submitContent}>
            <GearActionIcon size="sm" />
            <Text style={styles.submitText}>Analyze Symptom</Text>
          </View>
        )}
      </Pressable>

      {/* Result */}
      {result && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>AI Analysis</Text>
            <View style={[styles.urgencyBadge, { borderColor: urgencyColor[result.urgency] }]}>
              <Text style={[styles.urgencyText, { color: urgencyColor[result.urgency] }]}>
                {result.urgency.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.analysisText}>{result.ai_analysis}</Text>

          {result.suggested_codes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Likely OBD-II Codes</Text>
              <View style={styles.codeRow}>
                {result.suggested_codes.map((c) => (
                  <View key={c} style={styles.codePill}>
                    <Text style={styles.codePillText}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {result.probable_causes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Probable Causes</Text>
              {result.probable_causes.map((cause, i) => (
                <Text key={i} style={styles.bulletItem}>• {cause}</Text>
              ))}
            </View>
          )}

          {result.flowchart_steps.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Diagnostic Flowchart</Text>
              {result.flowchart_steps.map((step) => (
                <Pressable
                  key={step.step}
                  style={styles.flowStep}
                  onPress={() => setExpandedStep(expandedStep === step.step ? null : step.step)}
                >
                  <View style={styles.flowStepHeader}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{step.step}</Text>
                    </View>
                    <Text style={styles.flowInstruction}>{step.instruction}</Text>
                  </View>
                  {expandedStep === step.step && step.check && (
                    <View style={styles.flowDetail}>
                      {step.check && <Text style={styles.flowCheck}>✓ Check: {step.check}</Text>}
                      {step.if_yes && <Text style={styles.flowYes}>→ If yes: {step.if_yes}</Text>}
                      {step.if_no && <Text style={styles.flowNo}>→ If no: {step.if_no}</Text>}
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {result.related_tsbs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Related TSB Topics</Text>
              {result.related_tsbs.map((tsb, i) => (
                <Text key={i} style={styles.bulletItem}>• {tsb}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

