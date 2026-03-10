/**
 * ModelSelector — dropdown for choosing the AI model in chat.
 * Filters available models by user subscription tier.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AVAILABLE_MODELS,
  getModelsForTier,
  getDefaultModel,
  type ModelDefinition,
  type AIProvider,
} from '../../types/models';
import { getUserSubscription, type SubscriptionTier } from '../../services/subscription-service';

// ---------------------------------------------------------------------------
// Provider badge colors
// ---------------------------------------------------------------------------

const PROVIDER_COLORS: Record<AIProvider, string> = {
  openai: '#10a37f',
  anthropic: '#d4a27f',
  google: '#4285f4',
  xai: '#1d9bf0',
  deepseek: '#4f6df5',
  moonshot: '#6c5ce7',
};

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude',
  google: 'Gemini',
  xai: 'Grok',
  deepseek: 'DeepSeek',
  moonshot: 'Kimi',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ModelSelectorProps {
  userId: string;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ModelSelector({
  userId,
  selectedModelId,
  onSelectModel,
}: ModelSelectorProps) {
  const [visible, setVisible] = useState(false);
  const [models, setModels] = useState<ModelDefinition[]>([]);
  const [tier, setTier] = useState<SubscriptionTier>('free');

  useEffect(() => {
    let cancelled = false;
    getUserSubscription(userId)
      .then((sub) => {
        if (cancelled) return;
        setTier(sub.tier);
        setModels(getModelsForTier(sub.tier));
      })
      .catch(() => {
        if (cancelled) return;
        setModels(getModelsForTier('free'));
      });
    return () => { cancelled = true; };
  }, [userId]);

  const selected = AVAILABLE_MODELS.find((m) => m.id === selectedModelId) || getDefaultModel();

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <View style={[styles.providerDot, { backgroundColor: PROVIDER_COLORS[selected.provider] }]} />
        <Text style={styles.triggerText} numberOfLines={1}>
          {selected.name}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#999" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>Choose AI Model</Text>
            {tier === 'free' && (
              <Text style={styles.tierHint}>
                🔒 Upgrade to Pro to unlock premium models
              </Text>
            )}
            <FlatList
              data={models}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.id === selectedModelId && styles.optionSelected,
                  ]}
                  onPress={() => {
                    onSelectModel(item.id);
                    setVisible(false);
                  }}
                >
                  <View style={styles.optionRow}>
                    <View style={[styles.providerDot, { backgroundColor: PROVIDER_COLORS[item.provider] }]} />
                    <View style={styles.optionText}>
                      <Text style={styles.optionName}>{item.name}</Text>
                      <Text style={styles.optionDesc}>{item.description}</Text>
                    </View>
                    <View style={styles.badges}>
                      <View style={[styles.providerBadge, { backgroundColor: PROVIDER_COLORS[item.provider] + '22' }]}>
                        <Text style={[styles.badgeText, { color: PROVIDER_COLORS[item.provider] }]}>
                          {PROVIDER_LABELS[item.provider]}
                        </Text>
                      </View>
                      {item.tier === 'paid' && (
                        <View style={styles.proBadge}>
                          <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {item.id === selectedModelId && (
                    <Ionicons name="checkmark-circle" size={20} color="#00D4FF" style={styles.check} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  providerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  triggerText: {
    color: '#e0e0e0',
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 140,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dropdown: {
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dropdownTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  tierHint: {
    color: '#999',
    fontSize: 12,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  optionSelected: {
    backgroundColor: 'rgba(0,212,255,0.08)',
  },
  optionRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionText: {
    flex: 1,
  },
  optionName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  optionDesc: {
    color: '#888',
    fontSize: 11,
    marginTop: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  providerBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  proBadge: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeText: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '700',
  },
  check: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
});
