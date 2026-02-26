import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AppShell from '../components/layout/AppShell';
import GearActionIcon from '../components/branding/GearActionIcon';
import GearLogo from '../components/branding/GearLogo';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile, updateUserPreferences, deleteUserAccount } from '../services/auth-service';
import { getUserVehicles } from '../services/vehicle-service';
import { getMaintenanceRecords } from '../services/maintenance-service';
import { uploadFile, STORAGE_BUCKETS } from '../services/storage-service';
import { SubscriptionTiers } from '../types/user';
import type { UserPreferences } from '../types/user';
import type { Vehicle } from '../types/vehicle';
import { radii } from '../theme/tokens';
import type { ThemeMode } from '../theme/tokens';
import { fontFamilies, typeScale } from '../theme/typography';
import { useTheme } from '../contexts/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'account' | 'preferences' | 'subscription' | 'data' | 'integrations';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'account',       label: 'Account',     icon: 'person-outline' },
  { key: 'preferences',   label: 'Prefs',       icon: 'options-outline' },
  { key: 'subscription',  label: 'Plan',        icon: 'star-outline' },
  { key: 'data',          label: 'Data',        icon: 'cloud-download-outline' },
  { key: 'integrations',  label: 'Connect',     icon: 'link-outline' },
];

const DEFAULT_PREFS: UserPreferences = {
  distance_unit: 'miles',
  temperature_unit: 'fahrenheit',
  fuel_unit: 'gallons',
  currency: 'USD',
  language: 'en',
  theme_mode: 'dark',
  accent_color: '#33D6D2',
  maintenance_reminders: true,
  recall_alerts: true,
  chat_notifications: false,
  cost_alerts: false,
  email_notifications: true,
  push_notifications: false,
};

const ACCENT_COLORS = [
  { label: 'Teal',    value: '#33D6D2' },
  { label: 'Blue',    value: '#4AA3FF' },
  { label: 'Purple',  value: '#8B5CF6' },
  { label: 'Orange',  value: '#F59E0B' },
  { label: 'Green',   value: '#22C55E' },
  { label: 'Pink',    value: '#EC4899' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'MXN'];
const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Spanish', value: 'es' },
  { label: 'French',  value: 'fr' },
  { label: 'German',  value: 'de' },
  { label: 'Portuguese', value: 'pt' },
  { label: 'Japanese', value: 'ja' },
];

const TIER_ORDER = ['free', 'pro', 'mechanic', 'dealer'] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  return (
    <View style={s.card}>
      {title && <Text style={s.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

function SettingRow({
  label, sublabel, value, rightSlot, onPress,
}: {
  label: string; sublabel?: string; value?: string; rightSlot?: React.ReactNode; onPress?: () => void;
}) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const inner = (
    <View style={s.settingRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.settingLabel}>{label}</Text>
        {sublabel && <Text style={s.settingSubLabel}>{sublabel}</Text>}
      </View>
      {rightSlot ?? (value ? <Text style={s.settingValue}>{value}</Text> : null)}
    </View>
  );
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [pressed && s.pressed]}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

function ToggleRow({ label, sublabel, value, onValueChange }: {
  label: string; sublabel?: string; value: boolean; onValueChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <SettingRow
      label={label}
      sublabel={sublabel}
      rightSlot={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.brandAccent }}
          thumbColor={value ? colors.background : colors.textSecondary}
        />
      }
    />
  );
}

function SegmentControl<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  return (
    <View style={s.segment}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          accessibilityRole="button"
          onPress={() => onChange(opt.value)}
          style={({ pressed }) => [
            s.segmentOpt,
            opt.value === value && s.segmentOptActive,
            pressed && s.pressed,
          ]}
        >
          <Text style={[s.segmentLabel, opt.value === value && s.segmentLabelActive]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ComingSoonBadge() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  return (
    <View style={s.comingSoon}>
      <Text style={s.comingSoonText}>Coming Soon</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors, setTheme } = useTheme();
  const TIER_COLORS: Record<string, string> = {
    free: colors.textSecondary,
    pro: colors.brandAccent,
    mechanic: '#8B5CF6',
    dealer: '#F59E0B',
  };
  const { user, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [prefs, setPrefs]         = useState<UserPreferences>({ ...DEFAULT_PREFS, ...user?.preferences });
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [saving, setSaving]       = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user?.preferences) setPrefs({ ...DEFAULT_PREFS, ...user.preferences });
    if (user?.display_name) setDisplayName(user.display_name);
  }, [user]);

  const loadVehicles = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const rows = await getUserVehicles(user.user_id);
      setVehicles(rows);
    } catch { /* silent */ }
  }, [user?.user_id]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const setPref = <K extends keyof UserPreferences>(key: K, val: UserPreferences[K]) =>
    setPrefs((prev) => ({ ...prev, [key]: val }));

  async function handleSavePrefs() {
    if (!user?.user_id) return;
    setSaving(true);
    try {
      await updateUserPreferences(user.user_id, prefs);
      Alert.alert('Saved', 'Preferences updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save preferences.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    if (!user?.user_id) return;
    setSaving(true);
    try {
      await updateUserProfile(user.user_id, { display_name: displayName.trim() });
      Alert.alert('Saved', 'Profile updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePickAvatar() {
    if (!user?.user_id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission required', 'Allow photo library access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const blob  = await (await fetch(asset.uri)).blob();
      const ext   = asset.uri.split('.').pop() || 'jpg';
      const { url } = await uploadFile(
        STORAGE_BUCKETS.PROFILE_AVATARS,
        `${user.user_id}/avatar.${ext}`,
        blob,
        { contentType: asset.mimeType || 'image/jpeg', upsert: true }
      );
      await updateUserProfile(user.user_id, { avatar_url: url });
      Alert.alert('Done', 'Profile photo updated.');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleExport(format: 'json' | 'csv') {
    if (!user?.user_id) return;
    setExporting(true);
    try {
      const allRecords: any[] = [];
      for (const v of vehicles) {
        const recs = await getMaintenanceRecords(v.vehicle_id, user.user_id);
        allRecords.push(...recs);
      }

      let content = '';
      let filename = '';

      if (format === 'json') {
        content = JSON.stringify(
          { exported_at: new Date().toISOString(), user: { email: user.email, tier: user.tier }, vehicles, maintenance_records: allRecords },
          null, 2
        );
        filename = 'gear-ai-export.json';
      } else {
        const csvRows = [
          ['vehicle_id', 'year', 'make', 'model', 'mileage', 'record_title', 'record_type', 'record_date', 'cost'].join(','),
          ...allRecords.map((r) => {
            const v = vehicles.find((vv) => vv.vehicle_id === r.vehicle_id);
            return [v?.vehicle_id || '', v?.year || '', v?.make || '', v?.model || '',
              v?.current_mileage || '', r.title, r.type, r.date, r.cost || ''].join(',');
          }),
        ];
        content = csvRows.join('\n');
        filename = 'gear-ai-export.csv';
      }

      if (Platform.OS === 'web') {
        const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: 'Gear AI Export', message: content });
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and ALL data. This cannot be undone.\n\nAre you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Type "DELETE" to confirm.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Delete',
                  style: 'destructive',
                  onPress: async () => {
                    if (!user?.user_id) return;
                    try {
                      await deleteUserAccount(user.user_id);
                    } catch (e: any) {
                      Alert.alert('Error', e?.message || 'Delete failed.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  const currentTier = user?.tier || 'free';
  const tierCfg = SubscriptionTiers[currentTier];

  // ─── Tab Renderers ──────────────────────────────────────────────────────────

  function renderAccount() {
    return (
      <>
        <SectionCard title="Profile">
          <SettingRow label="Display Name"
            rightSlot={
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                style={s.inlineInput}
                placeholderTextColor={colors.textSecondary}
                placeholder="Your name"
              />
            }
          />
          <SettingRow label="Email" value={user?.email || '—'} />
          <SettingRow
            label="Profile Photo"
            sublabel={uploadingAvatar ? 'Uploading…' : 'Tap to update'}
            onPress={handlePickAvatar}
            rightSlot={<Ionicons name="camera-outline" size={18} color={colors.textSecondary} />}
          />
          <Pressable
            accessibilityRole="button"
            onPress={handleSaveProfile}
            disabled={saving}
            style={({ pressed }) => [s.primaryBtn, saving && s.btnDisabled, pressed && s.pressed]}
          >
            {saving ? (
              <Text style={s.primaryBtnText}>Saving…</Text>
            ) : (
              <View style={s.primaryBtnContent}>
                <GearActionIcon size="sm" />
                <Text style={s.primaryBtnText}>Save Profile</Text>
              </View>
            )}
          </Pressable>
        </SectionCard>

        <SectionCard title="Subscription">
          <SettingRow
            label="Current Plan"
            rightSlot={
              <View style={[s.tierBadge, { borderColor: TIER_COLORS[currentTier] }]}>
                <Text style={[s.tierBadgeText, { color: TIER_COLORS[currentTier] }]}>
                  {tierCfg?.name || currentTier}
                </Text>
              </View>
            }
          />
          <SettingRow label="Status"
            value={user?.subscription_status === 'active' ? 'Active' : user?.subscription_status || 'None'}
          />
          {tierCfg?.price_monthly !== undefined && tierCfg.price_monthly > 0 && (
            <SettingRow label="Billing" value={`$${tierCfg.price_monthly}/mo`} />
          )}
        </SectionCard>

        <SectionCard title="Session">
          <Pressable
            accessibilityRole="button"
            onPress={signOut}
            style={({ pressed }) => [s.dangerOutlineBtn, pressed && s.pressed]}
          >
            <Ionicons name="log-out-outline" size={16} color="#FCA5A5" />
            <Text style={s.dangerOutlineBtnText}>Sign Out</Text>
          </Pressable>
        </SectionCard>
      </>
    );
  }

  function renderPreferences() {
    const defaultVehicle = vehicles.find((v) => v.vehicle_id === prefs.default_vehicle_id);
    return (
      <>
        <SectionCard title="Units">
          <SettingRow label="Distance" sublabel="Odometer and routing"
            rightSlot={
              <SegmentControl
                value={prefs.distance_unit || 'miles'}
                options={[{ label: 'Miles', value: 'miles' }, { label: 'km', value: 'kilometers' }]}
                onChange={(v) => setPref('distance_unit', v)}
              />
            }
          />
          <SettingRow label="Temperature"
            rightSlot={
              <SegmentControl
                value={prefs.temperature_unit || 'fahrenheit'}
                options={[{ label: '°F', value: 'fahrenheit' }, { label: '°C', value: 'celsius' }]}
                onChange={(v) => setPref('temperature_unit', v)}
              />
            }
          />
          <SettingRow label="Fuel Volume"
            rightSlot={
              <SegmentControl
                value={prefs.fuel_unit || 'gallons'}
                options={[{ label: 'Gallons', value: 'gallons' }, { label: 'Liters', value: 'liters' }]}
                onChange={(v) => setPref('fuel_unit', v)}
              />
            }
          />
          <SettingRow label="Currency">
          </SettingRow>
          <View style={s.chipRow}>
            {CURRENCIES.map((c) => (
              <Pressable key={c} accessibilityRole="button" onPress={() => setPref('currency', c)}
                style={({ pressed }) => [
                  s.chip,
                  (prefs.currency || 'USD') === c && s.chipActive,
                  pressed && s.pressed,
                ]}
              >
                <Text style={[(prefs.currency || 'USD') === c ? s.chipTextActive : s.chipText]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Notifications">
          <ToggleRow label="Maintenance Reminders" sublabel="Due dates and service intervals"
            value={prefs.maintenance_reminders ?? true}
            onValueChange={(v) => setPref('maintenance_reminders', v)} />
          <ToggleRow label="Recall Alerts" sublabel="Safety and recall notices"
            value={prefs.recall_alerts ?? true}
            onValueChange={(v) => setPref('recall_alerts', v)} />
          <ToggleRow label="Chat Notifications" sublabel="AI assistant reply alerts"
            value={prefs.chat_notifications ?? false}
            onValueChange={(v) => setPref('chat_notifications', v)} />
          <ToggleRow label="Cost Alerts" sublabel="High-cost maintenance warnings"
            value={prefs.cost_alerts ?? false}
            onValueChange={(v) => setPref('cost_alerts', v)} />
          <ToggleRow label="Email Notifications"
            value={prefs.email_notifications ?? true}
            onValueChange={(v) => setPref('email_notifications', v)} />
          <ToggleRow label="Push Notifications"
            value={prefs.push_notifications ?? false}
            onValueChange={(v) => setPref('push_notifications', v)} />
        </SectionCard>

        <SectionCard title="Appearance">
          <SettingRow label="Theme Mode" />
          <View style={s.themeRow}>
            {([
              { key: 'dark',   label: 'Dark',   icon: 'moon-outline' },
              { key: 'light',  label: 'Light',  icon: 'sunny-outline' },
              { key: 'amoled', label: 'AMOLED', icon: 'contrast-outline' },
            ] as const).map((t) => (
              <Pressable
                key={t.key}
                accessibilityRole="button"
                onPress={() => { setPref('theme_mode', t.key); setTheme(t.key as ThemeMode); }}
                style={({ pressed }) => [
                  s.themeOption,
                  (prefs.theme_mode || 'dark') === t.key && s.themeOptionActive,
                  pressed && s.pressed,
                ]}
              >
                <Ionicons name={t.icon as any} size={20}
                  color={(prefs.theme_mode || 'dark') === t.key ? colors.brandAccent : colors.textSecondary}
                />
                <Text style={[s.themeOptionLabel, (prefs.theme_mode || 'dark') === t.key && { color: colors.brandAccent }]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <SettingRow label="Accent Color" />
          <View style={s.colorRow}>
            {ACCENT_COLORS.map((ac) => (
              <Pressable key={ac.value} accessibilityRole="button" onPress={() => setPref('accent_color', ac.value)}
                style={({ pressed }) => [s.colorSwatch, { backgroundColor: ac.value }, pressed && s.pressed]}
              >
                {(prefs.accent_color || colors.brandAccent) === ac.value && (
                  <Ionicons name="checkmark" size={14} color="#000" />
                )}
              </Pressable>
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Default Vehicle">
          <SettingRow
            label="Primary Vehicle"
            sublabel={defaultVehicle ? `${defaultVehicle.year} ${defaultVehicle.make} ${defaultVehicle.model}` : 'None selected'}
            rightSlot={<Ionicons name="chevron-down-outline" size={16} color={colors.textSecondary} />}
          />
          {vehicles.length > 0 && (
            <View style={{ gap: 6, marginTop: 4 }}>
              {vehicles.map((v) => {
                const isDefault = prefs.default_vehicle_id === v.vehicle_id;
                return (
                  <Pressable key={v.vehicle_id} accessibilityRole="button"
                    onPress={() => setPref('default_vehicle_id', v.vehicle_id)}
                    style={({ pressed }) => [s.vehicleOpt, isDefault && s.vehicleOptActive, pressed && s.pressed]}
                  >
                    <Ionicons name="car-outline" size={16} color={isDefault ? colors.brandAccent : colors.textSecondary} />
                    <Text style={[s.vehicleOptText, isDefault && { color: colors.brandAccent }]}>
                      {(v as any).nickname || `${v.year} ${v.make} ${v.model}`}
                    </Text>
                    {isDefault && <Ionicons name="checkmark-circle" size={16} color={colors.brandAccent} style={{ marginLeft: 'auto' }} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </SectionCard>

        <SectionCard title="Language">
          <View style={{ gap: 6 }}>
            {LANGUAGES.map((lang) => {
              const active = (prefs.language || 'en') === lang.value;
              return (
                <Pressable key={lang.value} accessibilityRole="button"
                  onPress={() => setPref('language', lang.value)}
                  style={({ pressed }) => [s.vehicleOpt, active && s.vehicleOptActive, pressed && s.pressed]}
                >
                  <Text style={[s.vehicleOptText, active && { color: colors.brandAccent }]}>{lang.label}</Text>
                  {active && <Ionicons name="checkmark-circle" size={16} color={colors.brandAccent} style={{ marginLeft: 'auto' }} />}
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        <Pressable
          accessibilityRole="button"
          onPress={handleSavePrefs}
          disabled={saving}
          style={({ pressed }) => [s.primaryBtn, saving && s.btnDisabled, pressed && s.pressed]}
        >
          {saving ? (
            <Text style={s.primaryBtnText}>Saving…</Text>
          ) : (
            <View style={s.primaryBtnContent}>
              <GearActionIcon size="sm" />
              <Text style={s.primaryBtnText}>Save Preferences</Text>
            </View>
          )}
        </Pressable>
      </>
    );
  }

  function renderSubscription() {
    const usageVehicles = vehicles.length;
    const maxVehicles   = tierCfg?.features?.max_vehicles;
    const aiLimit       = tierCfg?.limits?.ai_messages_per_day;

    return (
      <>
        <SectionCard title="Current Plan">
          <View style={s.planHero}>
            <View style={[s.planBadge, { borderColor: TIER_COLORS[currentTier] }]}>
              <Text style={[s.planBadgeText, { color: TIER_COLORS[currentTier] }]}>
                {tierCfg?.name || currentTier}
              </Text>
            </View>
            {tierCfg?.price_monthly !== undefined && (
              <Text style={s.planPrice}>
                {tierCfg.price_monthly === 0
                  ? 'Free'
                  : `$${tierCfg.price_monthly}/mo`}
              </Text>
            )}
          </View>
        </SectionCard>

        <SectionCard title="Usage">
          <View style={s.usageRow}>
            <View style={s.usageTile}>
              <Text style={s.usageTileValue}>{usageVehicles}</Text>
              <Text style={s.usageTileLabel}>
                {maxVehicles === 99999 ? 'Vehicles (Unlimited)' : `Vehicles / ${maxVehicles}`}
              </Text>
              {typeof maxVehicles === 'number' && maxVehicles !== 99999 && (
                <View style={s.usageBar}>
                  <View style={[s.usageBarFill, {
                    width: `${Math.min(100, (usageVehicles / maxVehicles) * 100)}%` as any,
                    backgroundColor: usageVehicles >= maxVehicles ? colors.danger : colors.brandAccent,
                  }]} />
                </View>
              )}
            </View>
            <View style={s.usageTile}>
              <Text style={s.usageTileValue}>{aiLimit ?? '∞'}</Text>
              <Text style={s.usageTileLabel}>AI Msgs / Day</Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Compare Plans">
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowTierModal(true)}
            style={({ pressed }) => [s.secondaryBtn, pressed && s.pressed]}
          >
            <Ionicons name="grid-outline" size={16} color={colors.textPrimary} />
            <Text style={s.secondaryBtnText}>View Full Tier Comparison</Text>
          </Pressable>
        </SectionCard>

        {currentTier === 'free' && (
          <SectionCard title="Upgrade">
            <Text style={s.upgradeDesc}>
              Unlock RAG-powered AI chat, OBD diagnostics, damage detection, and more.
            </Text>
            {(['pro', 'mechanic', 'dealer'] as const).map((tier) => {
              const t = SubscriptionTiers[tier];
              return (
                <View key={tier} style={[s.upgradeTierCard, { borderColor: TIER_COLORS[tier] }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.upgradeTierName, { color: TIER_COLORS[tier] }]}>{t.name}</Text>
                    <Text style={s.upgradeTierPrice}>
                      ${t.price_monthly}/mo
                      {t.price_yearly ? ` · $${t.price_yearly}/yr` : ''}
                    </Text>
                  </View>
                  <View style={[s.upgradeBtn, { backgroundColor: TIER_COLORS[tier] + '22', borderColor: TIER_COLORS[tier] }]}>
                    <Text style={[s.upgradeBtnText, { color: TIER_COLORS[tier] }]}>Select</Text>
                  </View>
                </View>
              );
            })}
            <Text style={s.upgradeNote}>
              In-app purchases via Stripe — billing managed securely.
            </Text>
          </SectionCard>
        )}

        {/* Tier Comparison Modal */}
        <Modal visible={showTierModal} animationType="slide" presentationStyle="pageSheet">
          <View style={s.modalRoot}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Plan Comparison</Text>
              <Pressable accessibilityRole="button" onPress={() => setShowTierModal(false)}
                style={({ pressed }) => [s.modalCloseBtn, pressed && s.pressed]}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {TIER_ORDER.map((tier) => {
                const t = SubscriptionTiers[tier];
                const isCurrent = tier === currentTier;
                return (
                  <View key={tier} style={[s.tierCompCard, isCurrent && { borderColor: TIER_COLORS[tier] }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Text style={[s.tierCompName, { color: TIER_COLORS[tier] }]}>{t.name}</Text>
                      <Text style={s.tierCompPrice}>
                        {t.price_monthly === 0 ? 'Free' : `$${t.price_monthly}/mo`}
                      </Text>
                      {isCurrent && <View style={[s.currentBadge, { borderColor: TIER_COLORS[tier] }]}>
                        <Text style={[s.currentBadgeText, { color: TIER_COLORS[tier] }]}>Current</Text>
                      </View>}
                    </View>
                    {([
                      ['Vehicles', typeof t.features.max_vehicles === 'number' && t.features.max_vehicles === 99999 ? 'Unlimited' : String(t.features.max_vehicles)],
                      ['AI Chat', t.features.basic_ai_chat ? '✓' : '✗'],
                      ['Manual RAG Chat', t.features.rag_manual_chat ? '✓' : '✗'],
                      ['OBD Diagnostics', t.features.obd_diagnostics ? '✓' : '✗'],
                      ['Damage Detection', t.features.damage_detection ? '✓' : '✗'],
                      ['Valuation Tracking', t.features.valuation_tracking ? '✓' : '✗'],
                      ['Marketplace Tools', t.features.marketplace_tools ? '✓' : '✗'],
                      ['API Access', t.features.api_access ? '✓' : '✗'],
                    ] as [string, string][]).map(([feat, val]) => (
                      <View key={feat} style={s.tierCompRow}>
                        <Text style={s.tierCompFeat}>{feat}</Text>
                        <Text style={[s.tierCompVal, val === '✓' && { color: colors.success }, val === '✗' && { color: colors.border }]}>{val}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      </>
    );
  }

  function renderData() {
    return (
      <>
        <SectionCard title="Export Data">
          <Text style={s.sectionDesc}>
            Download all your vehicles, maintenance records, and AI chat history.
          </Text>
          <View style={s.exportRow}>
            <Pressable accessibilityRole="button" onPress={() => handleExport('json')} disabled={exporting}
              style={({ pressed }) => [s.exportBtn, pressed && s.pressed, exporting && s.btnDisabled]}
            >
              <GearActionIcon size="sm" />
              <Text style={s.exportBtnText}>Export JSON</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => handleExport('csv')} disabled={exporting}
              style={({ pressed }) => [s.exportBtn, pressed && s.pressed, exporting && s.btnDisabled]}
            >
              <GearActionIcon size="sm" />
              <Text style={s.exportBtnText}>Export CSV</Text>
            </Pressable>
          </View>
          {exporting && <Text style={s.exportingLabel}>Preparing export…</Text>}
        </SectionCard>

        <SectionCard title="Import Data">
          <Text style={s.sectionDesc}>Bulk import from a spreadsheet or another app.</Text>
          <View style={[s.secondaryBtn, { opacity: 0.5 }]}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.textPrimary} />
            <Text style={s.secondaryBtnText}>Import from File</Text>
          </View>
          <ComingSoonBadge />
        </SectionCard>

        <SectionCard title="Backup & Restore">
          <Text style={s.sectionDesc}>Cloud backup of all your Gear AI data.</Text>
          <View style={[s.secondaryBtn, { opacity: 0.5 }]}>
            <Ionicons name="cloud-outline" size={16} color={colors.textPrimary} />
            <Text style={s.secondaryBtnText}>Create Backup</Text>
          </View>
          <ComingSoonBadge />
        </SectionCard>

        <SectionCard title="Danger Zone">
          <Text style={[s.sectionDesc, { color: '#FCA5A5' }]}>
            Permanently delete your account and all associated data. This is irreversible.
          </Text>
          <Pressable accessibilityRole="button" onPress={handleDeleteAccount}
            style={({ pressed }) => [s.dangerBtn, pressed && s.pressed]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.background} />
            <Text style={s.dangerBtnText}>Delete My Account</Text>
          </Pressable>
        </SectionCard>
      </>
    );
  }

  function renderIntegrations() {
    const integrations = [
      {
        title: 'OBD-II Device',
        desc: 'Pair a Bluetooth OBD-II scanner to read live diagnostics from your vehicle.',
        icon: 'hardware-chip-outline',
      },
      {
        title: 'Calendar Sync',
        desc: 'Sync maintenance reminders to Google Calendar or Apple Calendar.',
        icon: 'calendar-outline',
      },
      {
        title: 'Cloud Storage',
        desc: 'Connect Google Drive, iCloud, or Dropbox to back up documents and manuals.',
        icon: 'cloud-outline',
      },
      {
        title: 'Carfax / AutoCheck',
        desc: 'Pull full vehicle history reports using your VIN.',
        icon: 'car-sport-outline',
      },
    ];
    return (
      <>
        <Text style={s.sectionDesc} numberOfLines={2}>
          Connected services expand Gear AI's capabilities with your existing tools and hardware.
        </Text>
        {integrations.map((intg) => (
          <View key={intg.title} style={s.integrationCard}>
            <View style={s.integrationIcon}>
              <Ionicons name={intg.icon as any} size={22} color={colors.brandAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={s.integrationTitle}>{intg.title}</Text>
                <ComingSoonBadge />
              </View>
              <Text style={s.integrationDesc}>{intg.desc}</Text>
            </View>
          </View>
        ))}
      </>
    );
  }

  const s = makeStyles(colors);
  return (
    <AppShell routeKey="settings" title="Settings" subtitle="Account and platform preferences">
      {/* Tab Bar */}
      <View style={s.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarInner}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              onPress={() => setActiveTab(tab.key)}
              style={({ pressed }) => [s.tab, activeTab === tab.key && s.tabActive, pressed && s.pressed]}
            >
              <Ionicons
                name={tab.icon as any}
                size={15}
                color={activeTab === tab.key ? colors.brandAccent : colors.textSecondary}
              />
              <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Brand header — visible on all tabs */}
        <View style={s.brandRow}>
          <GearLogo variant="full" size="xs" />
        </View>

        {activeTab === 'account'       && renderAccount()}
        {activeTab === 'preferences'   && renderPreferences()}
        {activeTab === 'subscription'  && renderSubscription()}
        {activeTab === 'data'          && renderData()}
        {activeTab === 'integrations'  && renderIntegrations()}
      </ScrollView>
    </AppShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },

  // Tab bar
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabBarInner: { paddingHorizontal: 12, paddingVertical: 4, gap: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: radii.md, borderWidth: 1, borderColor: 'transparent',
  },
  tabActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  tabLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  tabLabelActive: { color: colors.brandAccent },

  // Brand
  brandRow: { alignItems: 'center', marginBottom: 4 },

  // Card
  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg,
    backgroundColor: colors.surface, padding: 14, gap: 10,
  },
  cardTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md },

  // Setting row
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, gap: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  settingLabel: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  settingSubLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },
  settingValue: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  inlineInput: {
    color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm,
    textAlign: 'right', minWidth: 120,
  },

  // Segment control
  segment: { flexDirection: 'row', gap: 4 },
  segmentOpt: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  segmentOptActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  segmentLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  segmentLabelActive: { color: colors.brandAccent },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  chipActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  chipText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  chipTextActive: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.xs },

  // Theme options
  themeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  themeOption: {
    flex: 1, alignItems: 'center', gap: 5, paddingVertical: 10,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  themeOptionActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  themeOptionLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },

  // Color swatches
  colorRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  colorSwatch: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },

  // Vehicle / language options
  vehicleOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40,
    paddingHorizontal: 10, borderRadius: radii.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  vehicleOptActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  vehicleOptText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, flex: 1 },

  // Buttons
  primaryBtn: {
    minHeight: 44, borderRadius: radii.md, backgroundColor: colors.brandAccent,
    justifyContent: 'center', alignItems: 'center',
  },
  primaryBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: { color: colors.background, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  secondaryBtn: {
    minHeight: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  secondaryBtnText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  dangerOutlineBtn: {
    minHeight: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.danger,
    backgroundColor: 'rgba(239,68,68,0.10)', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  dangerOutlineBtnText: { color: '#FCA5A5', fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  dangerBtn: {
    minHeight: 44, borderRadius: radii.md, backgroundColor: colors.danger,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  dangerBtnText: { color: colors.background, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  btnDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.88 },

  // Tier badge
  tierBadge: {
    borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 3,
  },
  tierBadgeText: { fontFamily: fontFamilies.heading, fontSize: typeScale.xs },

  // Subscription plan
  planHero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planBadge: {
    borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 6,
  },
  planBadgeText: { fontFamily: fontFamilies.heading, fontSize: typeScale.md },
  planPrice: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },

  // Usage
  usageRow: { flexDirection: 'row', gap: 10 },
  usageTile: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt, padding: 12, gap: 4,
  },
  usageTileValue: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.xxl },
  usageTileLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  usageBar: {
    height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden', marginTop: 4,
  },
  usageBarFill: { height: '100%', borderRadius: 2 },

  // Upgrade
  upgradeDesc: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  upgradeTierCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: radii.md, padding: 12,
    backgroundColor: colors.surfaceAlt,
  },
  upgradeTierName: { fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  upgradeTierPrice: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },
  upgradeBtn: {
    borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 6,
  },
  upgradeBtnText: { fontFamily: fontFamilies.heading, fontSize: typeScale.xs },
  upgradeNote: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textAlign: 'center' },

  // Tier comparison modal
  modalRoot: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  modalTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.lg },
  modalCloseBtn: { padding: 6 },
  tierCompCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg,
    backgroundColor: colors.surface, padding: 14,
  },
  tierCompName: { fontFamily: fontFamilies.heading, fontSize: typeScale.md },
  tierCompPrice: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  tierCompRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tierCompFeat: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  tierCompVal: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.xs },
  currentBadge: {
    borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 2,
  },
  currentBadgeText: { fontFamily: fontFamilies.body, fontSize: 10 },

  // Export
  sectionDesc: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  exportRow: { flexDirection: 'row', gap: 10 },
  exportBtn: {
    flex: 1, minHeight: 44, borderRadius: radii.md, borderWidth: 1,
    borderColor: colors.brandAccent, backgroundColor: colors.accentTint,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  exportBtnText: { color: colors.brandAccent, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  exportingLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textAlign: 'center' },

  // Coming soon
  comingSoon: {
    borderWidth: 1, borderColor: colors.warning, borderRadius: radii.full,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  comingSoonText: { color: colors.warning, fontFamily: fontFamilies.body, fontSize: 10 },

  // Integrations
  integrationCard: {
    flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg, backgroundColor: colors.surface, padding: 14, alignItems: 'flex-start',
  },
  integrationIcon: {
    width: 44, height: 44, borderRadius: radii.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  integrationTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  integrationDesc: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 3 },
});
}
