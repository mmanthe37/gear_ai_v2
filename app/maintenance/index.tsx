import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import AppShell from '../../components/layout/AppShell';
import GearActionIcon from '../../components/branding/GearActionIcon';
import GearLogo from '../../components/branding/GearLogo';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAllUserMaintenanceRecords,
  getServiceReminders,
  createServiceReminder,
  updateServiceReminderStatus,
  deleteServiceReminder,
  getCostAnalytics,
  getInstalledParts,
  createInstalledPart,
  deleteInstalledPart,
  getServiceProviders,
  createServiceProvider,
  deleteServiceProvider,
  getMaintenanceBudget,
  generateAIMaintenancePlan,
} from '../../services/maintenance-service';
import { getUserVehicles } from '../../services/vehicle-service';
import type {
  MaintenanceRecord,
  ServiceReminder,
  CostAnalytics,
  InstalledPart,
  ServiceProvider,
  MaintenanceBudget,
  MaintenanceInterval,
} from '../../types/maintenance';
import type { Vehicle } from '../../types/vehicle';
import { radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';
import { useTheme } from '../../contexts/ThemeContext';

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEVERITY_OVERDUE = '#EF4444';
const SEVERITY_DUE_SOON = '#F59E0B';
const SEVERITY_UPCOMING = '#10B981';

function getReminderSeverityColor(reminder: ServiceReminder, currentMileage?: number): string {
  if (reminder.status === 'overdue') return SEVERITY_OVERDUE;
  const now = new Date();
  const dueDateMs = reminder.due_date ? new Date(reminder.due_date).getTime() : null;
  const daysUntilDue = dueDateMs ? (dueDateMs - now.getTime()) / (1000 * 60 * 60 * 24) : null;
  const milesUntilDue =
    reminder.due_mileage && currentMileage ? reminder.due_mileage - currentMileage : null;

  if (
    (daysUntilDue !== null && daysUntilDue < 0) ||
    (milesUntilDue !== null && milesUntilDue < 0)
  ) {
    return SEVERITY_OVERDUE;
  }
  if (
    (daysUntilDue !== null && daysUntilDue <= 30) ||
    (milesUntilDue !== null && milesUntilDue <= 500)
  ) {
    return SEVERITY_DUE_SOON;
  }
  return SEVERITY_UPCOMING;
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type Tab = 'dashboard' | 'schedule' | 'records' | 'costs' | 'parts' | 'shops';
const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'records', label: 'Records' },
  { key: 'costs', label: 'Costs' },
  { key: 'parts', label: 'Parts' },
  { key: 'shops', label: 'Shops' },
];

// Part categories
const PART_CATEGORIES: InstalledPart['category'][] = [
  'oil','coolant','transmission_fluid','brake_fluid','power_steering_fluid',
  'fuel_filter','air_filter','cabin_filter','spark_plug','brake_pad',
  'brake_rotor','tire','battery','belt','other',
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MaintenanceScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(false);

  // Data
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reminders, setReminders] = useState<ServiceReminder[]>([]);
  const [analytics, setAnalytics] = useState<CostAnalytics | null>(null);
  const [parts, setParts] = useState<InstalledPart[]>([]);
  const [shops, setShops] = useState<ServiceProvider[]>([]);
  const [budget, setBudget] = useState<MaintenanceBudget | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  // Filter state
  const [recordFilter, setRecordFilter] = useState<'all' | 'routine' | 'repair' | 'inspection'>('all');

  // Add Part modal
  const [showAddPart, setShowAddPart] = useState(false);
  const [partName, setPartName] = useState('');
  const [partBrand, setPartBrand] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partCategory, setPartCategory] = useState<InstalledPart['category']>('other');
  const [partInstallDate, setPartInstallDate] = useState(new Date().toISOString().split('T')[0]);
  const [partInstallMileage, setPartInstallMileage] = useState('');
  const [partWarrantyMonths, setPartWarrantyMonths] = useState('');
  const [partSaving, setPartSaving] = useState(false);

  // Add Shop modal
  const [showAddShop, setShowAddShop] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopSpecialty, setShopSpecialty] = useState('');
  const [shopRating, setShopRating] = useState('');
  const [shopNotes, setShopNotes] = useState('');
  const [shopSaving, setShopSaving] = useState(false);

  const vehicleMap = useMemo(
    () => new Map(vehicles.map((v) => [v.vehicle_id, `${v.year} ${v.make} ${v.model}`])),
    [vehicles]
  );

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.vehicle_id === selectedVehicleId),
    [vehicles, selectedVehicleId]
  );

  const loadData = useCallback(async () => {
    if (!user?.user_id) return;
    setLoading(true);
    try {
      const [recordRows, vehicleRows] = await Promise.all([
        getAllUserMaintenanceRecords(user.user_id),
        getUserVehicles(user.user_id),
      ]);
      setRecords(recordRows);
      setVehicles(vehicleRows);
      const firstVehicle = vehicleRows[0];
      const vid = selectedVehicleId || firstVehicle?.vehicle_id || '';
      if (!selectedVehicleId && vid) setSelectedVehicleId(vid);

      const [reminderRows, analyticsData, shopRows, budgetData] = await Promise.all([
        vid ? getServiceReminders(vid, user.user_id).catch(() => [] as ServiceReminder[]) : Promise.resolve([] as ServiceReminder[]),
        getCostAnalytics(user.user_id).catch(() => null),
        getServiceProviders(user.user_id).catch(() => [] as ServiceProvider[]),
        getMaintenanceBudget(user.user_id).catch(() => null),
      ]);
      setReminders(reminderRows);
      setAnalytics(analyticsData);
      setShops(shopRows);
      setBudget(budgetData);

      if (vid) {
        const partRows = await getInstalledParts(vid).catch(() => [] as InstalledPart[]);
        setParts(partRows);
      }
    } catch (error) {
      console.warn('Could not load maintenance data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id, selectedVehicleId]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadVehicleData = useCallback(async (vid: string) => {
    if (!user?.user_id || !vid) return;
    try {
      const [reminderRows, partRows] = await Promise.all([
        getServiceReminders(vid, user.user_id).catch(() => [] as ServiceReminder[]),
        getInstalledParts(vid).catch(() => [] as InstalledPart[]),
      ]);
      setReminders(reminderRows);
      setParts(partRows);
    } catch (e) {
      console.warn('loadVehicleData error:', e);
    }
  }, [user?.user_id]);

  const handleVehicleSelect = useCallback((vid: string) => {
    setSelectedVehicleId(vid);
    loadVehicleData(vid);
  }, [loadVehicleData]);

  // ---------------------------------------------------------------------------
  // AI Schedule
  // ---------------------------------------------------------------------------

  const handleGenerateAISchedule = useCallback(async () => {
    if (!selectedVehicle || !user?.user_id) return;
    const openAiKey = (Constants.expoConfig?.extra?.openaiApiKey as string | undefined) || process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
    if (!openAiKey) {
      Alert.alert('API Key Missing', 'OpenAI API key not configured.');
      return;
    }
    setAiLoading(true);
    try {
      const intervals: MaintenanceInterval[] = await generateAIMaintenancePlan(
        {
          make: selectedVehicle.make,
          model: selectedVehicle.model,
          year: selectedVehicle.year,
          current_mileage: selectedVehicle.current_mileage,
        },
        openAiKey
      );
      for (const interval of intervals.slice(0, 10)) {
        await createServiceReminder(selectedVehicle.vehicle_id, user.user_id, {
          service_type: interval.service_type,
          title: interval.service_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          description: interval.description,
          interval_miles: interval.recurring_interval_miles,
          interval_months: interval.recurring_interval_months,
          priority: interval.severity === 'critical' ? 'high' : interval.severity === 'important' ? 'medium' : 'low',
          status: 'upcoming',
          notification_sent: false,
        }).catch(() => null);
      }
      await loadVehicleData(selectedVehicle.vehicle_id);
      Alert.alert('AI Schedule Generated', `Created ${Math.min(intervals.length, 10)} maintenance reminders.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to generate AI schedule.');
    } finally {
      setAiLoading(false);
    }
  }, [selectedVehicle, user?.user_id, loadVehicleData]);

  // ---------------------------------------------------------------------------
  // Add Part
  // ---------------------------------------------------------------------------

  const handleAddPart = useCallback(async () => {
    if (!selectedVehicleId || !partName.trim()) {
      Alert.alert('Missing fields', 'Part name is required.');
      return;
    }
    setPartSaving(true);
    try {
      await createInstalledPart({
        vehicle_id: selectedVehicleId,
        part_name: partName.trim(),
        brand: partBrand.trim() || undefined,
        part_number: partNumber.trim() || undefined,
        category: partCategory,
        install_date: partInstallDate,
        install_mileage: partInstallMileage ? parseInt(partInstallMileage, 10) : undefined,
        warranty_months: partWarrantyMonths ? parseInt(partWarrantyMonths, 10) : undefined,
      });
      const updated = await getInstalledParts(selectedVehicleId);
      setParts(updated);
      setShowAddPart(false);
      setPartName(''); setPartBrand(''); setPartNumber('');
      setPartCategory('other'); setPartInstallDate(new Date().toISOString().split('T')[0]);
      setPartInstallMileage(''); setPartWarrantyMonths('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save part.');
    } finally {
      setPartSaving(false);
    }
  }, [selectedVehicleId, partName, partBrand, partNumber, partCategory, partInstallDate, partInstallMileage, partWarrantyMonths]);

  // ---------------------------------------------------------------------------
  // Add Shop
  // ---------------------------------------------------------------------------

  const handleAddShop = useCallback(async () => {
    if (!user?.user_id || !shopName.trim()) {
      Alert.alert('Missing fields', 'Shop name is required.');
      return;
    }
    setShopSaving(true);
    try {
      await createServiceProvider(user.user_id, {
        name: shopName.trim(),
        phone: shopPhone.trim() || undefined,
        address: shopAddress.trim() || undefined,
        specialty: shopSpecialty.trim() || undefined,
        rating: shopRating ? parseInt(shopRating, 10) : undefined,
        notes: shopNotes.trim() || undefined,
        is_preferred: false,
      });
      const updated = await getServiceProviders(user.user_id);
      setShops(updated);
      setShowAddShop(false);
      setShopName(''); setShopPhone(''); setShopAddress('');
      setShopSpecialty(''); setShopRating(''); setShopNotes('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save shop.');
    } finally {
      setShopSaving(false);
    }
  }, [user?.user_id, shopName, shopPhone, shopAddress, shopSpecialty, shopRating, shopNotes]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const overdueReminders = useMemo(
    () => reminders.filter((r) => getReminderSeverityColor(r, selectedVehicle?.current_mileage) === SEVERITY_OVERDUE),
    [reminders, selectedVehicle]
  );

  const upcomingReminders = useMemo(
    () => reminders.filter((r) => r.status !== 'dismissed' && r.status !== 'completed').slice(0, 5),
    [reminders]
  );

  const filteredRecords = useMemo(() => {
    if (recordFilter === 'all') return records;
    return records.filter((r) => r.type === recordFilter);
  }, [records, recordFilter]);

  const partsByCategory = useMemo(() => {
    const map = new Map<string, InstalledPart[]>();
    parts.forEach((p) => {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    });
    return map;
  }, [parts]);

  const maxBarValue = useMemo(() => {
    if (!analytics) return 1;
    const last6 = analytics.by_month.slice(-6);
    return Math.max(...last6.map((m) => m.total), 1);
  }, [analytics]);

  // ---------------------------------------------------------------------------
  // Render tabs
  // ---------------------------------------------------------------------------

  const renderDashboard = () => (
    <View style={styles.tabContent}>
      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { label: 'Records', value: String(records.length) },
          { label: 'Total Spent', value: analytics ? formatCurrency(analytics.total_lifetime) : '--' },
          { label: 'Cost/Mile', value: analytics ? `$${analytics.cost_per_mile.toFixed(3)}` : '--' },
          { label: 'Overdue', value: String(overdueReminders.length), color: overdueReminders.length > 0 ? SEVERITY_OVERDUE : colors.textPrimary },
        ].map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={[styles.statValue, stat.color ? { color: stat.color } : undefined]}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Upcoming reminders */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Upcoming Services</Text>
          <Pressable
            style={({ pressed }) => [styles.aiButton, pressed && styles.buttonInteraction]}
            onPress={handleGenerateAISchedule}
            disabled={aiLoading || !selectedVehicleId}
          >
            {aiLoading ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <View style={styles.aiButtonContent}>
                <GearActionIcon size="sm" />
                <Text style={styles.aiButtonText}>AI Schedule</Text>
              </View>
            )}
          </Pressable>
        </View>
        {upcomingReminders.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming reminders. Tap AI Schedule to generate one.</Text>
        ) : (
          upcomingReminders.map((r) => {
            const severityColor = getReminderSeverityColor(r, selectedVehicle?.current_mileage);
            return (
              <View key={r.reminder_id} style={[styles.reminderRow, { borderLeftColor: severityColor }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reminderTitle}>{r.title}</Text>
                  <Text style={styles.reminderMeta}>
                    {r.due_date ? formatDate(r.due_date) : ''}
                    {r.due_mileage ? `  •  ${r.due_mileage.toLocaleString()} mi` : ''}
                  </Text>
                </View>
                <View style={[styles.severityBadge, { backgroundColor: severityColor + '33' }]}>
                  <Text style={[styles.severityText, { color: severityColor }]}>{r.status}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Recent records */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Records</Text>
        {records.slice(0, 3).length === 0 ? (
          <Text style={styles.emptyText}>No records yet.</Text>
        ) : (
          records.slice(0, 3).map((record) => (
            <Pressable
              key={record.record_id}
              style={({ pressed }) => [styles.recordRow, pressed && styles.buttonInteraction]}
              onPress={() => router.push(`/maintenance/${record.record_id}` as any)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.recordTitle}>{record.title}</Text>
                <Text style={styles.recordMeta}>{vehicleMap.get(record.vehicle_id) || ''} · {formatDate(record.date)}</Text>
              </View>
              <Text style={styles.recordCost}>{record.cost ? formatCurrency(record.cost) : '--'}</Text>
            </Pressable>
          ))
        )}
        <Pressable
          style={({ pressed }) => [styles.linkButton, pressed && styles.buttonInteraction]}
          onPress={() => router.push('/maintenance/new')}
        >
          <GearActionIcon size="sm" />
          <Text style={styles.linkButtonText}>New Record</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderSchedule = () => (
    <View style={styles.tabContent}>
      <View style={styles.vehiclePills}>
        {vehicles.map((v) => (
          <Pressable
            key={v.vehicle_id}
            style={({ pressed }) => [
              styles.pill,
              selectedVehicleId === v.vehicle_id && styles.pillActive,
              pressed && styles.buttonInteraction,
            ]}
            onPress={() => handleVehicleSelect(v.vehicle_id)}
          >
            <Text style={[styles.pillText, selectedVehicleId === v.vehicle_id && styles.pillTextActive]}>
              {v.year} {v.make} {v.model}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Service Reminders</Text>
          <Pressable
            style={({ pressed }) => [styles.aiButton, pressed && styles.buttonInteraction]}
            onPress={handleGenerateAISchedule}
            disabled={aiLoading || !selectedVehicleId}
          >
            {aiLoading
              ? <ActivityIndicator size="small" color={colors.background} />
              : (
                <View style={styles.aiButtonContent}>
                  <GearActionIcon size="sm" />
                  <Text style={styles.aiButtonText}>AI Plan</Text>
                </View>
              )
            }
          </Pressable>
        </View>
        {reminders.length === 0 ? (
          <Text style={styles.emptyText}>No reminders for this vehicle.</Text>
        ) : (
          reminders.map((r) => {
            const severityColor = getReminderSeverityColor(r, selectedVehicle?.current_mileage);
            return (
              <View key={r.reminder_id} style={[styles.reminderRow, { borderLeftColor: severityColor }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reminderTitle}>{r.title}</Text>
                  <Text style={styles.reminderMeta}>
                    {r.due_date ? `Due ${formatDate(r.due_date)}` : ''}
                    {r.due_mileage ? `  •  ${r.due_mileage.toLocaleString()} mi` : ''}
                    {r.interval_miles ? `  •  Every ${r.interval_miles.toLocaleString()} mi` : ''}
                    {r.interval_months ? `  •  Every ${r.interval_months} mo` : ''}
                  </Text>
                </View>
                <View style={styles.reminderActions}>
                  <View style={[styles.severityBadge, { backgroundColor: severityColor + '33' }]}>
                    <Text style={[styles.severityText, { color: severityColor }]}>{r.priority}</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.iconButton, pressed && styles.buttonInteraction]}
                    onPress={async () => {
                      await updateServiceReminderStatus(r.reminder_id, 'dismissed').catch(() => null);
                      setReminders((prev) => prev.filter((x) => x.reminder_id !== r.reminder_id));
                    }}
                  >
                    <Text style={styles.iconButtonText}>✕</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );

  const renderRecords = () => (
    <View style={styles.tabContent}>
      <View style={styles.filterRow}>
        {(['all', 'routine', 'repair', 'inspection'] as const).map((f) => (
          <Pressable
            key={f}
            style={({ pressed }) => [
              styles.filterButton,
              recordFilter === f && styles.filterButtonActive,
              pressed && styles.buttonInteraction,
            ]}
            onPress={() => setRecordFilter(f)}
          >
            <Text style={[styles.filterText, recordFilter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.card}>
        {filteredRecords.length === 0 ? (
          <View style={styles.emptyState}>
            <GearLogo variant="micro" size="lg" />
            <Text style={styles.emptyTitle}>No records</Text>
            <Text style={styles.emptySubtitle}>Add a service record to build your history.</Text>
          </View>
        ) : (
          filteredRecords.map((record) => {
            const hasOverdueNext = record.next_service_date && new Date(record.next_service_date) < new Date();
            const leftColor = hasOverdueNext ? SEVERITY_OVERDUE : colors.border;
            return (
              <Pressable
                key={record.record_id}
                style={({ pressed }) => [styles.recordCard, { borderLeftColor: leftColor }, pressed && styles.buttonInteraction]}
                onPress={() => router.push(`/maintenance/${record.record_id}` as any)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordTitle}>{record.title}</Text>
                  <Text style={styles.recordMeta}>
                    {vehicleMap.get(record.vehicle_id) || ''} · {formatDate(record.date)}
                    {record.mileage ? ` · ${record.mileage.toLocaleString()} mi` : ''}
                  </Text>
                  {record.description ? <Text style={styles.recordDesc} numberOfLines={1}>{record.description}</Text> : null}
                </View>
                <View style={styles.recordSide}>
                  <Text style={styles.recordTypeLabel}>{record.type}</Text>
                  <Text style={styles.recordCost}>{record.cost ? formatCurrency(record.cost) : '--'}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );

  const renderCosts = () => {
    const a = analytics;
    if (!a) return <ActivityIndicator color={colors.brandAccent} style={{ marginTop: 20 }} />;
    const last6 = a.by_month.slice(-6);
    const maxCatValue = Math.max(...a.by_category.map((c) => c.total), 1);
    const budgetAmount = budget?.amount || 0;
    const actualThis = budget?.period === 'monthly' ? a.total_this_month : a.total_this_year;
    const budgetPercent = budgetAmount > 0 ? Math.min((actualThis / budgetAmount) * 100, 100) : 0;
    const alertThreshold = budget?.alert_at_percent || 80;

    return (
      <View style={styles.tabContent}>
        {/* Summary cards */}
        <View style={styles.statsRow}>
          {[
            { label: 'Lifetime', value: formatCurrency(a.total_lifetime) },
            { label: 'This Year', value: formatCurrency(a.total_this_year) },
            { label: 'This Month', value: formatCurrency(a.total_this_month) },
            { label: 'Cost/Mile', value: `$${a.cost_per_mile.toFixed(3)}` },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Bar chart - last 6 months */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last 6 Months</Text>
          <View style={styles.barChart}>
            {last6.map((m) => {
              const barHeight = maxBarValue > 0 ? Math.max((m.total / maxBarValue) * 120, 4) : 4;
              const monthLabel = new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short' });
              return (
                <View key={m.month} style={styles.barColumn}>
                  <Text style={styles.barValue}>{m.total > 0 ? `$${Math.round(m.total)}` : ''}</Text>
                  <View style={[styles.bar, { height: barHeight }]} />
                  <Text style={styles.barLabel}>{monthLabel}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Category breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Category</Text>
          {a.by_category.length === 0 ? (
            <Text style={styles.emptyText}>No cost data yet.</Text>
          ) : (
            a.by_category.map((c) => (
              <View key={c.category} style={styles.categoryRow}>
                <Text style={styles.categoryLabel}>{c.category}</Text>
                <View style={styles.categoryBarTrack}>
                  <View style={[styles.categoryBar, { width: `${(c.total / maxCatValue) * 100}%` as any }]} />
                </View>
                <Text style={styles.categoryValue}>{formatCurrency(c.total)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Budget widget */}
        {budget && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Budget ({budget.period})</Text>
            <Text style={styles.budgetSub}>
              {formatCurrency(actualThis)} of {formatCurrency(budgetAmount)}
            </Text>
            <View style={styles.budgetTrack}>
              <View
                style={[
                  styles.budgetBar,
                  { width: `${budgetPercent}%` as any },
                  budgetPercent >= alertThreshold ? styles.budgetBarAlert : undefined,
                ]}
              />
            </View>
            {budgetPercent >= alertThreshold && (
              <Text style={styles.budgetAlert}>
                ⚠ You have used {budgetPercent.toFixed(0)}% of your {budget.period} budget.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderParts = () => (
    <View style={styles.tabContent}>
      <View style={styles.vehiclePills}>
        {vehicles.map((v) => (
          <Pressable
            key={v.vehicle_id}
            style={({ pressed }) => [
              styles.pill,
              selectedVehicleId === v.vehicle_id && styles.pillActive,
              pressed && styles.buttonInteraction,
            ]}
            onPress={() => handleVehicleSelect(v.vehicle_id)}
          >
            <Text style={[styles.pillText, selectedVehicleId === v.vehicle_id && styles.pillTextActive]}>
              {v.year} {v.make} {v.model}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Installed Parts</Text>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.buttonInteraction]}
            onPress={() => setShowAddPart(true)}
          >
            <Text style={styles.addButtonText}>+ Add Part</Text>
          </Pressable>
        </View>
        {parts.length === 0 ? (
          <Text style={styles.emptyText}>No parts tracked for this vehicle.</Text>
        ) : (
          Array.from(partsByCategory.entries()).map(([category, catParts]) => (
            <View key={category}>
              <Text style={styles.sectionLabel}>{category.replace(/_/g, ' ').toUpperCase()}</Text>
              {catParts.map((p) => (
                <View key={p.part_id} style={styles.partRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partName}>{p.part_name}</Text>
                    <Text style={styles.partMeta}>
                      {p.brand ? `${p.brand}  ` : ''}{p.part_number ? `#${p.part_number}  ` : ''}
                      {formatDate(p.install_date)}{p.install_mileage ? ` · ${p.install_mileage.toLocaleString()} mi` : ''}
                    </Text>
                    {p.warranty_months ? (
                      <Text style={styles.partWarranty}>Warranty: {p.warranty_months} months</Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.iconButton, pressed && styles.buttonInteraction]}
                    onPress={async () => {
                      await deleteInstalledPart(p.part_id).catch(() => null);
                      setParts((prev) => prev.filter((x) => x.part_id !== p.part_id));
                    }}
                  >
                    <Text style={styles.iconButtonText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </View>
  );

  const renderShops = () => (
    <View style={styles.tabContent}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Service Providers</Text>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.buttonInteraction]}
            onPress={() => setShowAddShop(true)}
          >
            <Text style={styles.addButtonText}>+ Add Shop</Text>
          </Pressable>
        </View>
        {shops.length === 0 ? (
          <Text style={styles.emptyText}>No shops saved yet.</Text>
        ) : (
          shops.map((shop) => (
            <View key={shop.provider_id} style={styles.shopCard}>
              <View style={{ flex: 1 }}>
                <View style={styles.shopHeader}>
                  <Text style={styles.shopName}>{shop.name}</Text>
                  {shop.is_preferred && <Text style={styles.preferredBadge}>★ Preferred</Text>}
                </View>
                {shop.specialty ? <Text style={styles.shopMeta}>{shop.specialty}</Text> : null}
                {shop.phone ? <Text style={styles.shopMeta}>📞 {shop.phone}</Text> : null}
                {shop.address ? <Text style={styles.shopMeta}>📍 {shop.address}</Text> : null}
                {shop.rating ? (
                  <Text style={styles.shopMeta}>{'★'.repeat(shop.rating)}{'☆'.repeat(5 - shop.rating)}</Text>
                ) : null}
                {shop.notes ? <Text style={styles.shopNotes}>{shop.notes}</Text> : null}
              </View>
              <Pressable
                style={({ pressed }) => [styles.iconButton, pressed && styles.buttonInteraction]}
                onPress={async () => {
                  await deleteServiceProvider(shop.provider_id).catch(() => null);
                  setShops((prev) => prev.filter((x) => x.provider_id !== shop.provider_id));
                }}
              >
                <Text style={styles.iconButtonText}>✕</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  const styles = makeStyles(colors);
  return (
    <AppShell routeKey="maintenance" title="Maintenance" subtitle="Track repairs, services & costs">
      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              styles.tabButton,
              activeTab === tab.key && styles.tabButtonActive,
              pressed && styles.buttonInteraction,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.brandAccent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'schedule' && renderSchedule()}
            {activeTab === 'records' && renderRecords()}
            {activeTab === 'costs' && renderCosts()}
            {activeTab === 'parts' && renderParts()}
            {activeTab === 'shops' && renderShops()}
          </>
        )}
      </ScrollView>

      {/* Add Part Modal */}
      <Modal visible={showAddPart} transparent animationType="fade" onRequestClose={() => setShowAddPart(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Installed Part</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Part Name *</Text>
                <TextInput style={styles.input} value={partName} onChangeText={setPartName} placeholder="Bosch Spark Plug" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Brand</Text>
                  <TextInput style={styles.input} value={partBrand} onChangeText={setPartBrand} placeholder="Bosch" placeholderTextColor={colors.textSecondary} />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Part #</Text>
                  <TextInput style={styles.input} value={partNumber} onChangeText={setPartNumber} placeholder="0242235927" placeholderTextColor={colors.textSecondary} />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {PART_CATEGORIES.map((cat) => (
                      <Pressable
                        key={cat}
                        style={({ pressed }) => [styles.chip, partCategory === cat && styles.chipActive, pressed && styles.buttonInteraction]}
                        onPress={() => setPartCategory(cat)}
                      >
                        <Text style={[styles.chipText, partCategory === cat && styles.chipTextActive]}>{cat.replace(/_/g, ' ')}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Install Date</Text>
                  <TextInput style={styles.input} value={partInstallDate} onChangeText={setPartInstallDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Mileage</Text>
                  <TextInput style={styles.input} value={partInstallMileage} onChangeText={setPartInstallMileage} keyboardType="numeric" placeholder="45000" placeholderTextColor={colors.textSecondary} />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Warranty (months)</Text>
                <TextInput style={styles.input} value={partWarrantyMonths} onChangeText={setPartWarrantyMonths} keyboardType="numeric" placeholder="24" placeholderTextColor={colors.textSecondary} />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonInteraction]} onPress={() => setShowAddPart(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonInteraction]} onPress={handleAddPart} disabled={partSaving}>
                {partSaving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonText}>Save Part</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Shop Modal */}
      <Modal visible={showAddShop} transparent animationType="fade" onRequestClose={() => setShowAddShop(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Service Shop</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Shop Name *</Text>
                <TextInput style={styles.input} value={shopName} onChangeText={setShopName} placeholder="Quick Lube Center" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone</Text>
                <TextInput style={styles.input} value={shopPhone} onChangeText={setShopPhone} placeholder="(555) 555-5555" keyboardType="phone-pad" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Address</Text>
                <TextInput style={styles.input} value={shopAddress} onChangeText={setShopAddress} placeholder="123 Main St, City, ST" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Specialty</Text>
                  <TextInput style={styles.input} value={shopSpecialty} onChangeText={setShopSpecialty} placeholder="Oil change, brakes" placeholderTextColor={colors.textSecondary} />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Rating (1-5)</Text>
                  <TextInput style={styles.input} value={shopRating} onChangeText={setShopRating} keyboardType="numeric" placeholder="5" placeholderTextColor={colors.textSecondary} />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput style={[styles.input, styles.notesInput]} value={shopNotes} onChangeText={setShopNotes} multiline numberOfLines={3} placeholder="Ask for Mike, good prices" placeholderTextColor={colors.textSecondary} />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonInteraction]} onPress={() => setShowAddShop(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonInteraction]} onPress={handleAddShop} disabled={shopSaving}>
                {shopSaving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonText}>Save Shop</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  tabBar: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, maxHeight: 52 },
  tabBarContent: { paddingHorizontal: 12, gap: 4, alignItems: 'center', height: 52 },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    minHeight: 36,
    justifyContent: 'center',
  },
  tabButtonActive: { backgroundColor: 'rgba(51, 214, 210, 0.14)', borderWidth: 1, borderColor: colors.brandAccent },
  tabText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  tabTextActive: { color: colors.brandAccent, fontFamily: fontFamilies.heading },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },
  tabContent: { gap: 12 },
  statsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md },
  statLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 4, textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md },
  emptyText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, textAlign: 'center', paddingVertical: 12 },
  emptyState: { minHeight: 160, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.md },
  emptySubtitle: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, textAlign: 'center' },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 6,
  },
  reminderTitle: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  reminderMeta: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },
  reminderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  severityBadge: { borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 3 },
  severityText: { fontFamily: fontFamilies.body, fontSize: typeScale.xs, textTransform: 'capitalize' },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recordTitle: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  recordMeta: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },
  recordDesc: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 4 },
  recordSide: { alignItems: 'flex-end', gap: 4 },
  recordTypeLabel: { color: colors.actionAccent, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textTransform: 'uppercase' },
  recordCost: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  linkButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  linkButtonText: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterButton: { minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: radii.full, backgroundColor: colors.surface, paddingHorizontal: 14, justifyContent: 'center' },
  filterButtonActive: { borderColor: colors.brandAccent, backgroundColor: 'rgba(51, 214, 210, 0.14)' },
  filterText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  filterTextActive: { color: colors.textPrimary },
  vehiclePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: radii.full, backgroundColor: colors.surface, paddingHorizontal: 14, justifyContent: 'center' },
  pillActive: { borderColor: colors.brandAccent, backgroundColor: 'rgba(51, 214, 210, 0.14)' },
  pillText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  pillTextActive: { color: colors.textPrimary },
  aiButton: { minHeight: 34, borderRadius: radii.md, backgroundColor: colors.brandAccent, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  aiButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiButtonText: { color: colors.background, fontFamily: fontFamilies.heading, fontSize: typeScale.xs },
  addButton: { minHeight: 34, borderRadius: radii.md, borderWidth: 1, borderColor: colors.brandAccent, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  sectionLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  partName: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  partMeta: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },
  partWarranty: { color: colors.success, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },
  shopCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  shopHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  shopName: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  preferredBadge: { color: colors.warning, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  shopMeta: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },
  shopNotes: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 4, fontStyle: 'italic' },
  iconButton: { padding: 6, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt },
  iconButtonText: { color: colors.textSecondary, fontSize: typeScale.xs },
  // Bar chart
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8, minHeight: 160 },
  barColumn: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '80%', backgroundColor: colors.brandAccent, borderRadius: radii.sm },
  barValue: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 10, textAlign: 'center' },
  barLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, width: 80 },
  categoryBarTrack: { flex: 1, height: 8, backgroundColor: colors.surfaceAlt, borderRadius: radii.full, overflow: 'hidden' },
  categoryBar: { height: '100%', backgroundColor: colors.actionAccent, borderRadius: radii.full },
  categoryValue: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, width: 64, textAlign: 'right' },
  budgetSub: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  budgetTrack: { height: 10, backgroundColor: colors.surfaceAlt, borderRadius: radii.full, overflow: 'hidden' },
  budgetBar: { height: '100%', backgroundColor: colors.success, borderRadius: radii.full },
  budgetBarAlert: { backgroundColor: colors.danger },
  budgetAlert: { color: colors.danger, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { width: '100%', maxWidth: 500, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.xl, padding: 20, gap: 14, maxHeight: '80%' },
  modalTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.lg },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  formGroup: { gap: 6 },
  formRow: { flexDirection: 'row', gap: 10 },
  label: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 30, borderWidth: 1, borderColor: colors.border, borderRadius: radii.full, backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
  chipActive: { borderColor: colors.brandAccent, backgroundColor: 'rgba(51, 214, 210, 0.14)' },
  chipText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  chipTextActive: { color: colors.textPrimary },
  primaryButton: { minHeight: 44, borderRadius: radii.md, backgroundColor: colors.brandAccent, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  primaryButtonText: { color: colors.background, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  secondaryButton: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  secondaryButtonText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  buttonInteraction: { opacity: 0.88 },
});
}
