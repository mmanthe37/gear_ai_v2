import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import GearActionIcon from '../../components/branding/GearActionIcon';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { getMaintenanceRecords } from '../../services/maintenance-service';
import {
  addMileageLog,
  getMileageLogs,
  updateVehicle,
  updateVehicleImage,
  getVehicleById,
} from '../../services/vehicle-service';
import { uploadFile, STORAGE_BUCKETS } from '../../services/storage-service';
import type { MaintenanceRecord } from '../../types/maintenance';
import type { MileageLogEntry, Vehicle, VehicleStatus } from '../../types/vehicle';
import { radii } from '../../theme/tokens';
import { fontFamilies, typeScale, letterSpacings } from '../../theme/typography';
import { sp, touchMinHeight, pressedOpacity } from '../../theme/spacing';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Badge, OverlayBackdrop } from '../../components/ui';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<VehicleStatus, string> = {
  active: 'Active', stored: 'Stored', for_sale: 'For Sale', sold: 'Sold', totaled: 'Totaled',
};

const STATUS_BADGE_VARIANTS: Record<VehicleStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  active: 'success',
  stored: 'info',
  for_sale: 'warning',
  sold: 'neutral',
  totaled: 'danger',
};

function getStatusColor(status: VehicleStatus, colors: ReturnType<typeof useTheme>['colors']): { color: string; bg: string } {
  switch (status) {
    case 'active': return { color: colors.success, bg: colors.successBannerBg };
    case 'stored': return { color: colors.actionAccent, bg: colors.accentTint };
    case 'for_sale': return { color: colors.warning, bg: colors.warningBannerBg };
    case 'sold': return { color: colors.textSecondary, bg: colors.surfaceAlt };
    case 'totaled': return { color: colors.danger, bg: colors.dangerBannerBg };
  }
}

const ALL_STATUSES: VehicleStatus[] = ['active', 'stored', 'for_sale', 'sold', 'totaled'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMileage(n?: number | null): string {
  if (!n && n !== 0) return '—';
  return `${n.toLocaleString()} mi`;
}

function calcAnnualMileage(logs: MileageLogEntry[]): string {
  if (logs.length < 2) return '—';
  const sorted = [...logs].sort((a, b) => a.logged_date.localeCompare(b.logged_date));
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const daysDiff = (new Date(newest.logged_date).getTime() - new Date(oldest.logged_date).getTime()) / 86_400_000;
  if (daysDiff < 7) return '—';
  const annualRate = Math.round(((newest.mileage - oldest.mileage) / daysDiff) * 365);
  return `~${annualRate.toLocaleString()} mi/yr`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: VehicleStatus }) {
  return (
    <Badge
      label={STATUS_LABELS[status || 'active']}
      variant={STATUS_BADGE_VARIANTS[status || 'active']}
      size="sm"
    />
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType || 'default'}
        style={styles.fieldInput}
        accessibilityLabel={label}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VehicleDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [mileageLogs, setMileageLogs] = useState<MileageLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [editVisible, setEditVisible] = useState(false);
  const [mileageVisible, setMileageVisible] = useState(false);
  const [statusVisible, setStatusVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Edit form state
  const [editNickname, setEditNickname] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPlate, setEditPlate] = useState('');
  const [editRegExpiry, setEditRegExpiry] = useState('');
  const [editInspectionDue, setEditInspectionDue] = useState('');
  const [editInsProvider, setEditInsProvider] = useState('');
  const [editInsPolicyNum, setEditInsPolicyNum] = useState('');
  const [editInsCoverage, setEditInsCoverage] = useState('');
  const [editInsExpiry, setEditInsExpiry] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editDealerInfo, setEditDealerInfo] = useState('');
  const [editLoanDetails, setEditLoanDetails] = useState('');
  const [saving, setSaving] = useState(false);

  // Mileage log form state
  const [newMileage, setNewMileage] = useState('');
  const [newMileageDate, setNewMileageDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newMileageNotes, setNewMileageNotes] = useState('');
  const [loggingMileage, setLoggingMileage] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.user_id || !id) return;
    setLoading(true);
    try {
      const [vehicleRow, maintenanceRows, mileageRows] = await Promise.all([
        getVehicleById(id, user.user_id),
        getMaintenanceRecords(id, user.user_id),
        getMileageLogs(id, user.user_id),
      ]);
      setVehicle(vehicleRow);
      setRecords(maintenanceRows.slice(0, 5));
      setMileageLogs(mileageRows);
    } catch (error) {
      console.warn('Could not load vehicle detail:', error);
    } finally {
      setLoading(false);
    }
  }, [id, user?.user_id]);

  useEffect(() => { loadData(); }, [loadData]);

  function openEdit() {
    if (!vehicle) return;
    setEditNickname(vehicle.nickname || '');
    setEditColor(vehicle.color || '');
    setEditPlate(vehicle.license_plate || '');
    setEditRegExpiry(vehicle.registration_expiry || '');
    setEditInspectionDue(vehicle.inspection_due || '');
    setEditInsProvider(vehicle.insurance_provider || '');
    setEditInsPolicyNum(vehicle.insurance_policy_number || '');
    setEditInsCoverage(vehicle.insurance_coverage_type || '');
    setEditInsExpiry(vehicle.insurance_expiry || '');
    setEditPurchaseDate(vehicle.purchase_date || '');
    setEditPurchasePrice(vehicle.purchase_price ? String(vehicle.purchase_price) : '');
    setEditDealerInfo(vehicle.dealer_seller_info || '');
    setEditLoanDetails(vehicle.loan_details || '');
    setEditVisible(true);
  }

  async function handleSaveEdit() {
    if (!vehicle || !user?.user_id) return;
    setSaving(true);
    try {
      await updateVehicle(vehicle.vehicle_id, user.user_id, {
        nickname: editNickname || undefined,
        color: editColor || undefined,
        license_plate: editPlate || undefined,
        registration_expiry: editRegExpiry || undefined,
        inspection_due: editInspectionDue || undefined,
        insurance_provider: editInsProvider || undefined,
        insurance_policy_number: editInsPolicyNum || undefined,
        insurance_coverage_type: editInsCoverage || undefined,
        insurance_expiry: editInsExpiry || undefined,
        purchase_date: editPurchaseDate || undefined,
        purchase_price: editPurchasePrice ? parseFloat(editPurchasePrice) : undefined,
        dealer_seller_info: editDealerInfo || undefined,
        loan_details: editLoanDetails || undefined,
      });
      setEditVisible(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogMileage() {
    if (!vehicle || !user?.user_id) return;
    const parsed = parseInt(newMileage, 10);
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert('Invalid mileage', 'Please enter a valid odometer reading.');
      return;
    }
    setLoggingMileage(true);
    try {
      await addMileageLog(vehicle.vehicle_id, user.user_id, parsed, newMileageDate, newMileageNotes || undefined);
      setMileageVisible(false);
      setNewMileage('');
      setNewMileageNotes('');
      setNewMileageDate(new Date().toISOString().slice(0, 10));
      loadData();
    } catch (e: any) {
      Alert.alert('Failed to log mileage', e?.message || 'Please try again.');
    } finally {
      setLoggingMileage(false);
    }
  }

  async function handleSetStatus(status: VehicleStatus) {
    if (!vehicle || !user?.user_id) return;
    try {
      await updateVehicle(vehicle.vehicle_id, user.user_id, { status });
      setStatusVisible(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Failed to update status', e?.message);
    }
  }

  async function handlePickPhoto() {
    if (!vehicle || !user?.user_id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow photo library access to upload a vehicle photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];

      let fileBody: Blob | Uint8Array;
      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        fileBody = await response.blob();
      } else {
        // On native, read as base64 then decode to Uint8Array (reliable for Supabase upload)
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        fileBody = bytes;
      }

      const ext = asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
      const path = `${user.user_id}/${vehicle.vehicle_id}.${ext}`;
      const { url } = await uploadFile(STORAGE_BUCKETS.VEHICLE_PHOTOS, path, fileBody, {
        contentType: asset.mimeType || 'image/jpeg',
        upsert: true,
      });
      await updateVehicleImage(vehicle.vehicle_id, user.user_id, url);
      setVehicle(prev => prev ? { ...prev, profile_image: url } : null);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  const vehicleTitle = vehicle
    ? vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    : 'Vehicle Detail';

  // ─── Render ────────────────────────────────────────────────────────────────

  const styles = makeStyles(colors);
  return (
    <AppShell routeKey="vehicle-detail" title={vehicleTitle} subtitle="Vehicle profile">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.brandAccent} style={styles.loadingIndicator} />
        ) : !vehicle ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Vehicle not found</Text>
            <Button
              variant="secondary"
              title="Back to Garage"
              onPress={() => router.replace('/garage')}
              accessibilityHint="Return to the garage list"
            />
          </View>
        ) : (
          <>
            {/* ── Photo Hero ─────────────────────────────────── */}
            <View style={styles.heroCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Upload vehicle photo"
                onPress={handlePickPhoto}
                style={styles.photoArea}
                disabled={uploadingPhoto}
              >
                {vehicle.profile_image ? (
                  <Image source={{ uri: vehicle.profile_image }} style={styles.heroImage} resizeMode="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
                    <Text style={styles.photoPlaceholderText}>Tap to add photo</Text>
                  </View>
                )}
                {uploadingPhoto && (
                  <View style={styles.photoOverlay}>
                    <ActivityIndicator color={colors.brandAccent} />
                  </View>
                )}
              </Pressable>

              <View style={styles.heroInfo}>
                <View style={styles.heroTitleRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.heroTitle}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                      {vehicle.trim ? ` ${vehicle.trim}` : ''}
                    </Text>
                    {vehicle.nickname ? (
                      <Text style={styles.heroNickname}>"{vehicle.nickname}"</Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Status: ${STATUS_LABELS[(vehicle.status as VehicleStatus) || 'active']}. Tap to change.`}
                    onPress={() => setStatusVisible(true)}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <StatusBadge status={(vehicle.status as VehicleStatus) || 'active'} />
                  </Pressable>
                </View>

                <View style={styles.heroActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="AI Chat"
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                    onPress={() =>
                      router.push({
                        pathname: '/chat/[id]',
                        params: { id: vehicle.vehicle_id, make: vehicle.make, model: vehicle.model, year: vehicle.year.toString() },
                      })
                    }
                  >
                    <GearActionIcon size="md" />
                    <Text style={styles.primaryButtonText}>AI Chat</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retrieve Manual"
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                    onPress={() =>
                      router.push({
                        pathname: '/manuals',
                        params: {
                          vehicleId: vehicle.vehicle_id,
                          vin: vehicle.vin || '',
                          year: vehicle.year.toString(),
                          make: vehicle.make,
                          model: vehicle.model,
                        },
                      })
                    }
                  >
                    <Ionicons name="document-text-outline" size={16} color={colors.textPrimary} />
                    <Text style={styles.secondaryButtonText}>Retrieve Manual</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit Profile"
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                    onPress={openEdit}
                  >
                    <Ionicons name="pencil-outline" size={16} color={colors.textPrimary} />
                    <Text style={styles.secondaryButtonText}>Edit Profile</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Log Maintenance"
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                    onPress={() => router.push('/maintenance/new')}
                  >
                    <Text style={styles.secondaryButtonText}>Log Maintenance</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* ── Overview ───────────────────────────────────── */}
            <SectionCard title="Vehicle Overview">
              <View style={styles.infoGrid}>
                <InfoRow label="VIN" value={vehicle.vin ? `***${vehicle.vin.slice(-6)}` : undefined} />
                <InfoRow label="Color" value={vehicle.color} />
                <InfoRow label="Fuel Type" value={vehicle.fuel_type} />
                <InfoRow label="Transmission" value={vehicle.transmission} />
                <InfoRow label="Drivetrain" value={vehicle.drivetrain} />
                <InfoRow label="Body Type" value={vehicle.body_type} />
              </View>
            </SectionCard>

            {/* ── Odometer / Mileage History ─────────────────── */}
            <SectionCard title="Odometer History">
              <View style={styles.mileageHeader}>
                <View>
                  <Text style={styles.mileageCurrent}>
                    {fmtMileage(vehicle.current_mileage)}
                  </Text>
                  <Text style={styles.mileageSubtext}>
                    Annual avg: {calcAnnualMileage(mileageLogs)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Log odometer reading"
                  style={({ pressed }) => [styles.logMileageBtn, pressed && styles.pressed]}
                  onPress={() => {
                    setNewMileage(vehicle.current_mileage ? String(vehicle.current_mileage) : '');
                    setMileageVisible(true);
                  }}
                >
                  <Ionicons name="add-outline" size={16} color={colors.brandAccent} />
                  <Text style={styles.logMileageBtnText}>Log Reading</Text>
                </Pressable>
              </View>

              {mileageLogs.length > 0 && (
                <View style={styles.mileageList}>
                  {mileageLogs.slice(0, 6).map((log) => (
                    <View key={log.log_id || `${log.logged_date}-${log.mileage}`} style={styles.mileageRow}>
                      <Ionicons name="speedometer-outline" size={14} color={colors.brandAccent} />
                      <Text style={styles.mileageRowValue}>{log.mileage.toLocaleString()} mi</Text>
                      <Text style={styles.mileageRowDate}>{fmtDate(log.logged_date)}</Text>
                      {log.notes ? <Text style={styles.mileageRowNotes} numberOfLines={1}>{log.notes}</Text> : null}
                    </View>
                  ))}
                </View>
              )}
            </SectionCard>

            {/* ── Registration & Inspection ──────────────────── */}
            <SectionCard title="Registration & Inspection">
              <View style={styles.infoGrid}>
                <InfoRow label="License Plate" value={vehicle.license_plate} />
                <InfoRow label="Registration Expires" value={fmtDate(vehicle.registration_expiry)} />
                <InfoRow label="Inspection Due" value={fmtDate(vehicle.inspection_due)} />
              </View>
            </SectionCard>

            {/* ── Insurance ──────────────────────────────────── */}
            <SectionCard title="Insurance">
              <View style={styles.infoGrid}>
                <InfoRow label="Provider" value={vehicle.insurance_provider} />
                <InfoRow label="Policy Number" value={vehicle.insurance_policy_number} />
                <InfoRow label="Coverage Type" value={vehicle.insurance_coverage_type} />
                <InfoRow label="Policy Expires" value={fmtDate(vehicle.insurance_expiry)} />
              </View>
            </SectionCard>

            {/* ── Purchase Info ──────────────────────────────── */}
            <SectionCard title="Purchase Info">
              <View style={styles.infoGrid}>
                <InfoRow label="Purchase Date" value={fmtDate(vehicle.purchase_date)} />
                <InfoRow
                  label="Purchase Price"
                  value={vehicle.purchase_price ? `$${Number(vehicle.purchase_price).toLocaleString()}` : undefined}
                />
                <InfoRow label="Dealer / Seller" value={vehicle.dealer_seller_info} />
                <InfoRow label="Loan Details" value={vehicle.loan_details} />
              </View>
            </SectionCard>

            {/* ── Recent Maintenance ─────────────────────────── */}
            <SectionCard title="Recent Maintenance">
              {records.length === 0 ? (
                <Text style={styles.emptyText}>No maintenance records yet.</Text>
              ) : (
                records.map((record) => (
                  <View key={record.record_id} style={styles.maintenanceRow}>
                    <View style={styles.flex1}>
                      <Text style={styles.maintenanceTitle}>{record.title}</Text>
                      <Text style={styles.maintenanceMeta}>{record.type} · {record.date}</Text>
                    </View>
                    <Text style={styles.maintenanceCost}>
                      {record.cost ? `$${record.cost.toFixed(2)}` : '—'}
                    </Text>
                  </View>
                ))
              )}
            </SectionCard>
          </>
        )}
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════
          EDIT PROFILE MODAL
      ═══════════════════════════════════════════════════════ */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Vehicle Profile</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close edit modal"
              onPress={() => setEditVisible(false)}
              style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalSection}>Identity</Text>
            <FormField label="Nickname" value={editNickname} onChangeText={setEditNickname} placeholder='e.g. "Daily Driver"' />
            <FormField label="Color" value={editColor} onChangeText={setEditColor} placeholder="e.g. Midnight Black" />

            <Text style={styles.modalSection}>Registration</Text>
            <FormField label="License Plate" value={editPlate} onChangeText={setEditPlate} placeholder="e.g. ABC-1234" />
            <FormField label="Registration Expiry (YYYY-MM-DD)" value={editRegExpiry} onChangeText={setEditRegExpiry} placeholder="2025-12-31" />
            <FormField label="Inspection Due (YYYY-MM-DD)" value={editInspectionDue} onChangeText={setEditInspectionDue} placeholder="2025-06-30" />

            <Text style={styles.modalSection}>Insurance</Text>
            <FormField label="Provider" value={editInsProvider} onChangeText={setEditInsProvider} placeholder="e.g. State Farm" />
            <FormField label="Policy Number" value={editInsPolicyNum} onChangeText={setEditInsPolicyNum} placeholder="POL-123456" />
            <FormField label="Coverage Type" value={editInsCoverage} onChangeText={setEditInsCoverage} placeholder="e.g. Full Coverage" />
            <FormField label="Policy Expiry (YYYY-MM-DD)" value={editInsExpiry} onChangeText={setEditInsExpiry} placeholder="2025-12-31" />

            <Text style={styles.modalSection}>Purchase Info</Text>
            <FormField label="Purchase Date (YYYY-MM-DD)" value={editPurchaseDate} onChangeText={setEditPurchaseDate} placeholder="2022-03-15" />
            <FormField label="Purchase Price ($)" value={editPurchasePrice} onChangeText={setEditPurchasePrice} keyboardType="decimal-pad" placeholder="28500" />
            <FormField label="Dealer / Seller" value={editDealerInfo} onChangeText={setEditDealerInfo} placeholder="e.g. City Toyota" />
            <FormField label="Loan Details" value={editLoanDetails} onChangeText={setEditLoanDetails} placeholder="e.g. 60-mo @ 4.9% — Chase Bank" />
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              variant="secondary"
              title="Cancel"
              onPress={() => setEditVisible(false)}
              accessibilityHint="Close without saving"
            />
            <Button
              variant="primary"
              title="Save Changes"
              onPress={handleSaveEdit}
              loading={saving}
              disabled={saving}
              style={styles.flex1}
              accessibilityHint="Save vehicle profile changes"
            />
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          LOG MILEAGE MODAL
      ═══════════════════════════════════════════════════════ */}
      <Modal visible={mileageVisible} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Odometer Reading</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close mileage modal"
              onPress={() => setMileageVisible(false)}
              style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.modalContent}>
            <FormField label="Odometer Reading (mi)" value={newMileage} onChangeText={setNewMileage} keyboardType="numeric" placeholder="e.g. 47500" />
            <FormField label="Date (YYYY-MM-DD)" value={newMileageDate} onChangeText={setNewMileageDate} placeholder="2025-06-01" />
            <FormField label="Notes (optional)" value={newMileageNotes} onChangeText={setNewMileageNotes} placeholder="e.g. Oil change trip" />
          </View>

          <View style={styles.modalFooter}>
            <Button
              variant="secondary"
              title="Cancel"
              onPress={() => setMileageVisible(false)}
              accessibilityHint="Close without saving"
            />
            <Button
              variant="primary"
              title="Save Reading"
              onPress={handleLogMileage}
              loading={loggingMileage}
              disabled={loggingMileage}
              style={styles.flex1}
              accessibilityHint="Save odometer reading"
            />
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          STATUS PICKER MODAL
      ═══════════════════════════════════════════════════════ */}
      <Modal visible={statusVisible} animationType="fade" transparent>
        <View style={styles.statusOverlayRoot}>
          <OverlayBackdrop onDismiss={() => setStatusVisible(false)} />
          <View style={styles.statusSheet}>
            <Text style={styles.statusSheetTitle}>Set Vehicle Status</Text>
            {ALL_STATUSES.map((s) => {
              const cfg = getStatusColor(s, colors);
              const current = (vehicle?.status || 'active') === s;
              return (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`Set status to ${STATUS_LABELS[s]}`}
                  onPress={() => handleSetStatus(s)}
                  style={({ pressed }) => [
                    styles.statusOption,
                    current && { borderColor: cfg.color, backgroundColor: cfg.bg },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                  <Text style={[styles.statusOptionText, current && { color: cfg.color }]}>{STATUS_LABELS[s]}</Text>
                  {current && <Ionicons name="checkmark" size={16} color={cfg.color} style={{ marginLeft: 'auto' as const }} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: sp[4], gap: sp[3] },

  loadingIndicator: { marginTop: sp[10] },
  flex1: { flex: 1 },

  emptyState: {
    minHeight: 220, borderRadius: radii.lg, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', gap: sp[3], padding: sp[3],
  },
  emptyTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.lg },
  emptyText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },

  // Hero card
  heroCard: {
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, overflow: 'hidden',
  },
  photoArea: { height: 180, width: '100%' },
  heroImage: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', gap: sp[2],
  },
  photoPlaceholderText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: colors.modalOverlay,
    justifyContent: 'center', alignItems: 'center',
  },
  heroInfo: { padding: sp[3], gap: sp[3] },
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sp[3] },
  heroTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.xl },
  heroNickname: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.sm, marginTop: 2 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[2] },

  // Section card
  sectionCard: {
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, padding: sp[3], gap: sp[3],
  },
  sectionTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md },

  // Info grid
  infoGrid: { gap: sp[2] },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: sp[2], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  infoValue: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, textAlign: 'right', flex: 1, marginLeft: sp[2] },

  // Mileage section
  mileageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mileageCurrent: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.xxl },
  mileageSubtext: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },
  logMileageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: sp[1],
    borderWidth: 1, borderColor: colors.brandAccent, borderRadius: radii.md,
    paddingHorizontal: sp[3], paddingVertical: sp[2],
    backgroundColor: colors.accentTint,
  },
  logMileageBtnText: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  mileageList: { gap: sp[2], marginTop: sp[1] },
  mileageRow: {
    flexDirection: 'row', alignItems: 'center', gap: sp[2],
    paddingVertical: sp[2], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  mileageRowValue: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  mileageRowDate: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  mileageRowNotes: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, flex: 1 },

  // Maintenance section
  maintenanceRow: {
    flexDirection: 'row', alignItems: 'center', gap: sp[3],
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: sp[3], paddingVertical: sp[3],
  },
  maintenanceTitle: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  maintenanceMeta: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: sp[1] },
  maintenanceCost: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },

  // Buttons
  primaryButton: {
    minHeight: touchMinHeight, borderRadius: radii.md, backgroundColor: colors.brandAccent,
    paddingHorizontal: sp[3], justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: sp[2],
  },
  primaryButtonText: { color: colors.background, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  secondaryButton: {
    minHeight: touchMinHeight, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: sp[3], flexDirection: 'row', gap: sp[2],
  },
  secondaryButtonText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  buttonDisabled: { opacity: 0.6 },
  pressed: { opacity: pressedOpacity },

  // Modal
  modalRoot: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: sp[4], paddingVertical: sp[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.lg },
  modalCloseBtn: { padding: sp[2] },
  modalScroll: { flex: 1 },
  modalContent: { padding: sp[4], gap: sp[3] },
  modalSection: {
    color: colors.textSecondary, fontFamily: fontFamilies.heading,
    fontSize: typeScale.xs, letterSpacing: letterSpacings.wider, textTransform: 'uppercase',
    marginTop: sp[2], marginBottom: 2,
  },
  modalFooter: {
    flexDirection: 'row', gap: sp[3], padding: sp[4],
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  // Form fields
  fieldGroup: { gap: sp[1] },
  fieldLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  fieldInput: {
    minHeight: touchMinHeight, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: sp[3],
    color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm,
  },

  // Status sheet
  statusOverlayRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  statusSheet: {
    zIndex: 1,
    backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    borderWidth: 1, borderColor: colors.border,
    padding: sp[5], gap: sp[3],
  },
  statusSheetTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md, marginBottom: sp[1] },
  statusOption: {
    flexDirection: 'row', alignItems: 'center', gap: sp[3],
    minHeight: sp[12], borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: sp[3],
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusOptionText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
});

}
