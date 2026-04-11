import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
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
import { useRouter } from 'expo-router';
import AppShell from '../components/layout/AppShell';
import GearActionIcon from '../components/branding/GearActionIcon';
import GearLogo from '../components/branding/GearLogo';
import { OverlayBackdrop } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile, updateUserPreferences, deleteUserAccount } from '../services/auth-service';
import { getUserVehicles } from '../services/vehicle-service';
import { getMaintenanceRecords } from '../services/maintenance-service';
import { uploadFile, STORAGE_BUCKETS } from '../services/storage-service';
import { SubscriptionTiers } from '../types/user';
import type { UserPreferences, SubscriptionTier } from '../types/user';
import type { Vehicle } from '../types/vehicle';
import { radii } from '../theme/tokens';
import type { ThemeMode } from '../theme/tokens';
import { fontFamilies, fontWeights, typeScale } from '../theme/typography';
import { sp, touchMinHeight, pressedOpacity } from '../theme/spacing';
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
      <View style={s.flexOne}>
        <Text style={s.settingLabel}>{label}</Text>
        {sublabel && <Text style={s.settingSubLabel}>{sublabel}</Text>}
      </View>
      {rightSlot ?? (value ? <Text style={s.settingValue}>{value}</Text> : null)}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [pressed && s.pressed]}
      >
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
          accessibilityLabel={opt.label}
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
  const { colors, setTheme, setAccentColor } = useTheme();
  const TIER_COLORS: Record<string, string> = {
    free: colors.textSecondary,
    pro: colors.brandAccent,
    mechanic: '#8B5CF6',
    dealer: '#F59E0B',
  };
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [prefs, setPrefs]         = useState<UserPreferences>({ ...DEFAULT_PREFS, ...user?.preferences });
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [saving, setSaving]       = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [upgradeTargetTier, setUpgradeTargetTier] = useState<SubscriptionTier | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeIntegration, setActiveIntegration] = useState<string | null>(null);

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
            accessibilityLabel="Save profile"
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
            accessibilityLabel="Sign out"
            onPress={signOut}
            style={({ pressed }) => [s.dangerOutlineBtn, pressed && s.pressed]}
          >
            <Ionicons name="log-out-outline" size={16} color={colors.danger} />
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
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Currency ${c}`} onPress={() => setPref('currency', c)}
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
                accessibilityLabel={`Theme ${t.label}`}
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
              <Pressable key={ac.value} accessibilityRole="button" accessibilityLabel={`Accent color ${ac.label}`} onPress={() => { setPref('accent_color', ac.value); setAccentColor(ac.value); }}
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
            <View style={s.optionList}>
              {vehicles.map((v) => {
                const isDefault = prefs.default_vehicle_id === v.vehicle_id;
                return (
                  <Pressable key={v.vehicle_id} accessibilityRole="button"
                    accessibilityLabel={`Select ${(v as any).nickname || `${v.year} ${v.make} ${v.model}`} as default`}
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
          <View style={s.optionList}>
            {LANGUAGES.map((lang) => {
              const active = (prefs.language || 'en') === lang.value;
              return (
                <Pressable key={lang.value} accessibilityRole="button"
                  accessibilityLabel={`Language ${lang.label}`}
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
          accessibilityLabel="Save preferences"
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
            accessibilityLabel="View full tier comparison"
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
                  <View style={s.flexOne}>
                    <Text style={[s.upgradeTierName, { color: TIER_COLORS[tier] }]}>{t.name}</Text>
                    <Text style={s.upgradeTierPrice}>
                      ${t.price_monthly}/mo
                      {t.price_yearly ? ` · $${t.price_yearly}/yr` : ''}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${t.name} plan`}
                    onPress={() => setUpgradeTargetTier(tier)}
                    style={({ pressed }) => [s.upgradeBtn, { backgroundColor: TIER_COLORS[tier] + '22', borderColor: TIER_COLORS[tier] }, pressed && s.pressed]}
                  >
                    <Text style={[s.upgradeBtnText, { color: TIER_COLORS[tier] }]}>Select</Text>
                  </Pressable>
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
              <Pressable accessibilityRole="button" accessibilityLabel="Close tier comparison" onPress={() => setShowTierModal(false)}
                style={({ pressed }) => [s.modalCloseBtn, pressed && s.pressed]}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.modalScrollContent}>
              {TIER_ORDER.map((tier) => {
                const t = SubscriptionTiers[tier];
                const isCurrent = tier === currentTier;
                return (
                  <View key={tier} style={[s.tierCompCard, isCurrent && { borderColor: TIER_COLORS[tier] }]}>
                    <View style={s.tierCompCardHeader}>
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
                    {!isCurrent && tier !== 'free' && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${t.name}`}
                        onPress={() => { setShowTierModal(false); setUpgradeTargetTier(tier); }}
                        style={({ pressed }) => [s.upgradeBtn, { marginTop: sp[3], alignSelf: 'flex-end', backgroundColor: TIER_COLORS[tier] + '22', borderColor: TIER_COLORS[tier] }, pressed && s.pressed]}
                      >
                        <Text style={[s.upgradeBtnText, { color: TIER_COLORS[tier] }]}>Select</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </Modal>

        {/* Upgrade Info Modal */}
        <Modal visible={upgradeTargetTier !== null} animationType="slide" presentationStyle="pageSheet">
          {upgradeTargetTier !== null && (() => {
            const t = SubscriptionTiers[upgradeTargetTier];
            const color = TIER_COLORS[upgradeTargetTier];
            return (
              <View style={s.modalRoot}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Upgrade to {t.name}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Close ${t.name} upgrade`} onPress={() => setUpgradeTargetTier(null)}
                    style={({ pressed }) => [s.modalCloseBtn, pressed && s.pressed]}
                  >
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={s.modalScrollContentLg}>
                  <View style={[s.upgradeModalPriceBadge, { borderColor: color }]}>
                    <Text style={[s.upgradeModalTierName, { color }]}>{t.name}</Text>
                    <Text style={s.upgradeModalPrice}>
                      {t.price_monthly === 0 ? 'Free' : `$${t.price_monthly}/mo`}
                      {t.price_yearly ? ` · $${t.price_yearly}/yr` : ''}
                    </Text>
                  </View>
                  <View style={s.upgradeModalFeatures}>
                    {([
                      ['Vehicles', t.features.max_vehicles === 'unlimited' ? 'Unlimited' : `Up to ${t.features.max_vehicles}`],
                      ['AI Chat', t.features.basic_ai_chat ? '✓' : '✗'],
                      ['Manual RAG Chat', t.features.rag_manual_chat ? '✓' : '✗'],
                      ['OBD Diagnostics', t.features.obd_diagnostics ? '✓' : '✗'],
                      ['Damage Detection', t.features.damage_detection ? '✓' : '✗'],
                      ['Valuation Tracking', t.features.valuation_tracking ? '✓' : '✗'],
                      ['Marketplace Tools', t.features.marketplace_tools ? '✓' : '✗'],
                      ['API Access', t.features.api_access ? '✓' : '✗'],
                      ...(t.limits.ai_messages_per_day !== undefined
                        ? [['AI Messages / Day', String(t.limits.ai_messages_per_day)] as [string, string]]
                        : []),
                    ] as [string, string][]).map(([feat, val]) => (
                      <View key={feat} style={s.tierCompRow}>
                        <Text style={s.tierCompFeat}>{feat}</Text>
                        <Text style={[s.tierCompVal, val === '✓' && { color: colors.success }, val === '✗' && { color: colors.border }]}>{val}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={s.upgradeModalNote}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
                    <Text style={s.upgradeModalNoteText}>
                      Subscription management is coming soon. To upgrade early, contact us.
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Contact support"
                    onPress={() => Linking.openURL('mailto:support@gear.ai')}
                    style={({ pressed }) => [s.upgradeModalContactBtn, { borderColor: color, backgroundColor: color + '22' }, pressed && s.pressed]}
                  >
                    <Ionicons name="mail-outline" size={16} color={color} />
                    <Text style={[s.upgradeModalContactBtnText, { color }]}>Contact Support</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    onPress={() => setUpgradeTargetTier(null)}
                    style={({ pressed }) => [s.secondaryBtn, pressed && s.pressed]}
                  >
                    <Text style={s.secondaryBtnText}>Close</Text>
                  </Pressable>
                </ScrollView>
              </View>
            );
          })()}
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
            <Pressable accessibilityRole="button" accessibilityLabel="Export as JSON" onPress={() => handleExport('json')} disabled={exporting}
              style={({ pressed }) => [s.exportBtn, pressed && s.pressed, exporting && s.btnDisabled]}
            >
              <GearActionIcon size="sm" />
              <Text style={s.exportBtnText}>Export JSON</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Export as CSV" onPress={() => handleExport('csv')} disabled={exporting}
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
          <Text style={[s.sectionDesc, { color: colors.danger }]}>
            Permanently delete your account and all associated data. This is irreversible.
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Delete my account" onPress={handleDeleteAccount}
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
    const vin = vehicles[0]?.vin ?? '';
    const notificationsEnabled = prefs.push_notifications ?? false;

    type IntgAction = { label: string; icon: string; onPress: () => void; primary?: boolean };
    type IntgConfig = {
      title: string; icon: string; desc: string;
      status: string; statusOk: boolean;
      modalTitle: string; modalContent: string;
      actions: IntgAction[];
    };

    const integrationConfigs: IntgConfig[] = [
      {
        title: 'OBD-II Device',
        icon: 'hardware-chip-outline',
        desc: 'Pair a Bluetooth OBD-II scanner to read live diagnostics from your vehicle.',
        status: 'Available',
        statusOk: false,
        modalTitle: 'OBD-II / ELM327 Scanner',
        modalContent:
          "To use live diagnostics, you'll need a Bluetooth ELM327 OBD-II adapter (available on Amazon for ~$15–$40). Once you have one:\n\n1. Plug the adapter into your car's OBD-II port (under the dash)\n2. Turn your car's ignition to ON\n3. Pair the adapter in your phone's Bluetooth settings\n4. Return to Diagnostics and tap 'Connect OBD Adapter'\n\nCompatible adapters: Veepeak OBDCheck BLE+, FIXD, BlueDriver",
        actions: [
          {
            label: 'Shop Adapters',
            icon: 'cart-outline',
            onPress: () => Linking.openURL('https://www.amazon.com/s?k=elm327+bluetooth+obd2+adapter'),
          },
          {
            label: 'Go to Diagnostics',
            icon: 'pulse-outline',
            primary: true,
            onPress: () => { setActiveIntegration(null); router.push('/diagnostics'); },
          },
        ],
      },
      {
        title: 'Calendar Sync',
        icon: 'calendar-outline',
        desc: 'Receive push notifications for upcoming maintenance and service reminders.',
        status: notificationsEnabled ? 'Enabled' : 'Set Up',
        statusOk: notificationsEnabled,
        modalTitle: 'Maintenance Reminders',
        modalContent: notificationsEnabled
          ? 'Push notifications are enabled. Gear AI will remind you about upcoming maintenance, recalls, and service intervals.'
          : 'Gear AI can send you push notifications for upcoming maintenance. Enable notifications in your device settings to receive reminders.',
        actions: [
          {
            label: 'Open Notification Settings',
            icon: 'notifications-outline',
            primary: true,
            onPress: () => Linking.openURL(Platform.OS === 'ios' ? 'app-settings:' : 'app-settings:'),
          },
        ],
      },
      {
        title: 'Cloud Storage',
        icon: 'cloud-outline',
        desc: 'Vehicles, maintenance records, and chat history synced to secure cloud storage.',
        status: '✓ Active',
        statusOk: true,
        modalTitle: 'Cloud Backup',
        modalContent:
          'Your Gear AI data (vehicles, maintenance records, chat history) is automatically synced to our secure cloud via Supabase. No additional setup needed.\n\nFor manual backup, use Settings → Data → Export JSON.',
        actions: [
          {
            label: 'Export Data',
            icon: 'download-outline',
            primary: true,
            onPress: () => { setActiveIntegration(null); setActiveTab('data'); },
          },
        ],
      },
      {
        title: 'Carfax / AutoCheck',
        icon: 'car-sport-outline',
        desc: 'Pull full vehicle history reports using your VIN.',
        status: 'Available',
        statusOk: false,
        modalTitle: 'Vehicle History Reports',
        modalContent: vehicles.length === 0
          ? 'Add a vehicle first to check its history.'
          : `Pull a full vehicle history report using your VIN directly from Carfax or AutoCheck.\n\nVIN: ${vin}`,
        actions: vehicles.length === 0 ? [] : [
          {
            label: 'Check on Carfax',
            icon: 'document-text-outline',
            onPress: () => Linking.openURL(`https://www.carfax.com/vehicle/${vin}`),
          },
          {
            label: 'Check on AutoCheck',
            icon: 'search-outline',
            primary: true,
            onPress: () => Linking.openURL(`https://www.autocheck.com/vehiclehistory/?vin=${vin}`),
          },
        ],
      },
    ];

    const active = integrationConfigs.find((c) => c.title === activeIntegration);

    return (
      <>
        <Text style={s.sectionDesc} numberOfLines={2}>
          Connected services expand Gear AI's capabilities with your existing tools and hardware.
        </Text>
        {integrationConfigs.map((intg) => (
          <Pressable
            key={intg.title}
            accessibilityRole="button"
            accessibilityLabel={`${intg.title} integration`}
            onPress={() => setActiveIntegration(intg.title)}
            style={({ pressed }) => [s.integrationCard, pressed && s.pressed]}
          >
            <View style={[s.integrationIcon, intg.statusOk && { borderColor: colors.success, backgroundColor: colors.successBannerBg }]}>
              <Ionicons name={intg.icon as any} size={22} color={intg.statusOk ? colors.success : colors.brandAccent} />
            </View>
            <View style={s.flexOne}>
              <View style={s.integrationHeaderRow}>
                <Text style={s.integrationTitle}>{intg.title}</Text>
                <View style={[s.intgStatusBadge, intg.statusOk && s.intgStatusBadgeOk]}>
                  <Text style={[s.intgStatusText, intg.statusOk && s.intgStatusTextOk]}>{intg.status}</Text>
                </View>
              </View>
              <Text style={s.integrationDesc}>{intg.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>
        ))}

        {/* Integration Detail Modal */}
        <Modal
          visible={!!activeIntegration}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setActiveIntegration(null)}
        >
          <View style={s.modalRoot}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{active?.modalTitle ?? ''}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close integration details"
                onPress={() => setActiveIntegration(null)}
                style={({ pressed }) => [s.modalCloseBtn, pressed && s.pressed]}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.modalScrollContentLg}>
              {active && (
                <>
                  <View style={s.intgModalIconWrap}>
                    <Ionicons name={active.icon as any} size={36} color={colors.brandAccent} />
                  </View>
                  <Text style={s.intgModalContent}>{active.modalContent}</Text>
                  {active.actions.length > 0 && (
                    <View style={s.intgModalActions}>
                      {active.actions.map((action) => (
                        <Pressable
                          key={action.label}
                          accessibilityRole="button"
                          accessibilityLabel={action.label}
                          onPress={action.onPress}
                          style={({ pressed }) => [
                            action.primary ? s.primaryBtn : s.secondaryBtn,
                            pressed && s.pressed,
                          ]}
                        >
                          {action.primary ? (
                            <View style={s.primaryBtnContent}>
                              <Ionicons name={action.icon as any} size={16} color={colors.background} />
                              <Text style={s.primaryBtnText}>{action.label}</Text>
                            </View>
                          ) : (
                            <>
                              <Ionicons name={action.icon as any} size={16} color={colors.textPrimary} />
                              <Text style={s.secondaryBtnText}>{action.label}</Text>
                            </>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </Modal>
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
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: activeTab === tab.key }}
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
  content: { padding: sp[4], gap: sp[4], paddingBottom: sp[10] },

  // Shared
  flexOne: { flex: 1 },

  // Tab bar
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabBarInner: { paddingHorizontal: sp[3], paddingVertical: sp[1], gap: sp[1] },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: sp[1],
    paddingHorizontal: sp[3], paddingVertical: sp[2],
    borderRadius: radii.md, borderWidth: 1, borderColor: 'transparent',
  },
  tabActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  tabLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, fontWeight: fontWeights.medium },
  tabLabelActive: { color: colors.brandAccent },

  // Brand
  brandRow: { alignItems: 'center', marginBottom: sp[1] },

  // Card
  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg,
    backgroundColor: colors.surface, padding: sp[4], gap: sp[3],
  },
  cardTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md, fontWeight: fontWeights.semibold },

  // Setting row
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: sp[2], gap: sp[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  settingLabel: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, fontWeight: fontWeights.medium },
  settingSubLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: sp[1] },
  settingValue: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  inlineInput: {
    color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm,
    textAlign: 'right', minWidth: 120,
  },

  // Segment control
  segment: { flexDirection: 'row', gap: sp[1] },
  segmentOpt: {
    paddingHorizontal: sp[3], paddingVertical: sp[1],
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  segmentOptActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  segmentLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, fontWeight: fontWeights.medium },
  segmentLabelActive: { color: colors.brandAccent },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[2] },
  chip: {
    paddingHorizontal: sp[3], paddingVertical: sp[2], borderRadius: radii.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  chipActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  chipText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, fontWeight: fontWeights.medium },
  chipTextActive: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.xs, fontWeight: fontWeights.medium },

  // Theme options
  themeRow: { flexDirection: 'row', gap: sp[2], marginTop: sp[1] },
  themeOption: {
    flex: 1, alignItems: 'center', gap: sp[1], paddingVertical: sp[3],
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  themeOptionActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  themeOptionLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, fontWeight: fontWeights.medium },

  // Color swatches
  colorRow: { flexDirection: 'row', gap: sp[3], marginTop: sp[1] },
  colorSwatch: {
    width: sp[8], height: sp[8], borderRadius: sp[4],
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },

  // Option list (vehicles / languages)
  optionList: { gap: sp[2], marginTop: sp[1] },

  // Vehicle / language options
  vehicleOpt: {
    flexDirection: 'row', alignItems: 'center', gap: sp[2], minHeight: touchMinHeight,
    paddingHorizontal: sp[3], borderRadius: radii.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  vehicleOptActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  vehicleOptText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, fontWeight: fontWeights.medium, flex: 1 },

  // Buttons
  primaryBtn: {
    minHeight: touchMinHeight, borderRadius: radii.md, backgroundColor: colors.brandAccent,
    justifyContent: 'center', alignItems: 'center',
  },
  primaryBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp[2],
  },
  primaryBtnText: { color: colors.background, fontFamily: fontFamilies.heading, fontSize: typeScale.sm, fontWeight: fontWeights.semibold },
  secondaryBtn: {
    minHeight: touchMinHeight, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: sp[2],
  },
  secondaryBtnText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, fontWeight: fontWeights.medium },
  dangerOutlineBtn: {
    minHeight: touchMinHeight, borderRadius: radii.md, borderWidth: 1, borderColor: colors.danger,
    backgroundColor: colors.dangerBannerBg, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: sp[2],
  },
  dangerOutlineBtnText: { color: colors.danger, fontFamily: fontFamilies.heading, fontSize: typeScale.sm, fontWeight: fontWeights.semibold },
  dangerBtn: {
    minHeight: touchMinHeight, borderRadius: radii.md, backgroundColor: colors.danger,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp[2],
  },
  dangerBtnText: { color: colors.background, fontFamily: fontFamilies.heading, fontSize: typeScale.sm, fontWeight: fontWeights.semibold },
  btnDisabled: { opacity: 0.55 },
  pressed: { opacity: pressedOpacity },

  // Tier badge
  tierBadge: {
    borderWidth: 1, borderRadius: radii.full, paddingHorizontal: sp[3], paddingVertical: sp[1],
  },
  tierBadgeText: { fontFamily: fontFamilies.heading, fontSize: typeScale.xs, fontWeight: fontWeights.bold },

  // Subscription plan
  planHero: { flexDirection: 'row', alignItems: 'center', gap: sp[3] },
  planBadge: {
    borderWidth: 1, borderRadius: radii.md, paddingHorizontal: sp[4], paddingVertical: sp[2],
  },
  planBadgeText: { fontFamily: fontFamilies.heading, fontSize: typeScale.md, fontWeight: fontWeights.bold },
  planPrice: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },

  // Usage
  usageRow: { flexDirection: 'row', gap: sp[3] },
  usageTile: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt, padding: sp[3], gap: sp[1],
  },
  usageTileValue: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.xxl, fontWeight: fontWeights.bold },
  usageTileLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  usageBar: {
    height: sp[1], borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden', marginTop: sp[1],
  },
  usageBarFill: { height: '100%', borderRadius: 2 },

  // Upgrade
  upgradeDesc: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  upgradeTierCard: {
    flexDirection: 'row', alignItems: 'center', gap: sp[3],
    borderWidth: 1, borderRadius: radii.md, padding: sp[3],
    backgroundColor: colors.surfaceAlt,
  },
  upgradeTierName: { fontFamily: fontFamilies.heading, fontSize: typeScale.sm, fontWeight: fontWeights.bold },
  upgradeTierPrice: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: sp[1] },
  upgradeBtn: {
    borderWidth: 1, borderRadius: radii.md, paddingHorizontal: sp[3], paddingVertical: sp[2],
  },
  upgradeBtnText: { fontFamily: fontFamilies.heading, fontSize: typeScale.xs, fontWeight: fontWeights.semibold },
  upgradeNote: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textAlign: 'center' },

  // Tier comparison modal
  modalRoot: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: sp[4], paddingVertical: sp[4],
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  modalTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.lg, fontWeight: fontWeights.bold },
  modalCloseBtn: { padding: sp[2] },
  modalScrollContent: { padding: sp[4], gap: sp[3] },
  modalScrollContentLg: { padding: sp[5], gap: sp[4] },
  tierCompCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg,
    backgroundColor: colors.surface, padding: sp[4],
  },
  tierCompCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: sp[2], marginBottom: sp[2],
  },
  tierCompName: { fontFamily: fontFamilies.heading, fontSize: typeScale.md, fontWeight: fontWeights.bold },
  tierCompPrice: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  tierCompRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: sp[1], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tierCompFeat: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  tierCompVal: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.xs, fontWeight: fontWeights.semibold },
  currentBadge: {
    borderWidth: 1, borderRadius: radii.full, paddingHorizontal: sp[2], paddingVertical: sp[1],
  },
  currentBadgeText: { fontFamily: fontFamilies.body, fontSize: typeScale.xs, fontWeight: fontWeights.medium },

  // Export
  sectionDesc: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  exportRow: { flexDirection: 'row', gap: sp[3] },
  exportBtn: {
    flex: 1, minHeight: touchMinHeight, borderRadius: radii.md, borderWidth: 1,
    borderColor: colors.brandAccent, backgroundColor: colors.accentTint,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp[2],
  },
  exportBtnText: { color: colors.brandAccent, fontFamily: fontFamilies.heading, fontSize: typeScale.sm, fontWeight: fontWeights.semibold },
  exportingLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textAlign: 'center' },

  // Coming soon
  comingSoon: {
    borderWidth: 1, borderColor: colors.warning, borderRadius: radii.full,
    paddingHorizontal: sp[2], paddingVertical: sp[1], alignSelf: 'flex-start',
    backgroundColor: colors.warningBannerBg,
  },
  comingSoonText: { color: colors.warning, fontFamily: fontFamilies.body, fontSize: typeScale.xs, fontWeight: fontWeights.medium },

  // Upgrade info modal
  upgradeModalPriceBadge: {
    borderWidth: 1, borderRadius: radii.lg, padding: sp[4],
    alignItems: 'center' as const, backgroundColor: colors.surface,
  },
  upgradeModalTierName: { fontFamily: fontFamilies.heading, fontSize: typeScale.xl, fontWeight: fontWeights.bold, marginBottom: sp[1] },
  upgradeModalPrice: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  upgradeModalFeatures: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg,
    backgroundColor: colors.surface, paddingHorizontal: sp[4], paddingVertical: sp[1],
  },
  upgradeModalNote: {
    flexDirection: 'row' as const, gap: sp[2], alignItems: 'flex-start' as const,
    padding: sp[4], borderRadius: radii.md,
    backgroundColor: colors.warningBannerBg, borderWidth: 1, borderColor: colors.warning,
  },
  upgradeModalNoteText: {
    flex: 1, color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm,
  },
  upgradeModalContactBtn: {
    minHeight: touchMinHeight, borderRadius: radii.md, borderWidth: 1,
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: sp[2],
  },
  upgradeModalContactBtnText: { fontFamily: fontFamilies.heading, fontSize: typeScale.sm, fontWeight: fontWeights.semibold },

  // Integrations
  integrationCard: {
    flexDirection: 'row', gap: sp[3], borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg, backgroundColor: colors.surface, padding: sp[4], alignItems: 'center',
  },
  integrationIcon: {
    width: touchMinHeight, height: touchMinHeight, borderRadius: radii.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  integrationHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp[2],
  },
  integrationTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.sm, fontWeight: fontWeights.semibold },
  integrationDesc: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: sp[1] },

  // Integration status badges
  intgStatusBadge: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.full,
    paddingHorizontal: sp[2], paddingVertical: sp[1], backgroundColor: colors.surfaceAlt,
  },
  intgStatusBadgeOk: { borderColor: colors.success, backgroundColor: colors.successBannerBg },
  intgStatusText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, fontWeight: fontWeights.medium },
  intgStatusTextOk: { color: colors.success },

  // Integration detail modal
  intgModalIconWrap: {
    width: 72, height: 72, borderRadius: radii.lg, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: sp[1],
  },
  intgModalContent: {
    color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm,
    lineHeight: typeScale.sm * 1.5,
  },
  intgModalActions: { gap: sp[3], marginTop: sp[2] },
});
}
