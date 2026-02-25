import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import GearActionIcon from '../../components/branding/GearActionIcon';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMaintenanceRecordById,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
} from '../../services/maintenance-service';
import { getUserVehicles } from '../../services/vehicle-service';
import type { MaintenanceRecord, MaintenanceType } from '../../types/maintenance';
import type { Vehicle } from '../../types/vehicle';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

const SEVERITY_OVERDUE = '#EF4444';
const SEVERITY_DUE_SOON = '#F59E0B';
const SEVERITY_UPCOMING = '#10B981';

function getNextServiceColor(nextDate?: string): string {
  if (!nextDate) return colors.border;
  const now = new Date();
  const next = new Date(nextDate);
  const daysUntil = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntil < 0) return SEVERITY_OVERDUE;
  if (daysUntil <= 30) return SEVERITY_DUE_SOON;
  return SEVERITY_UPCOMING;
}

const TYPE_COLORS: Record<string, string> = {
  routine: '#10B981',
  repair: '#F59E0B',
  inspection: '#4AA3FF',
  diagnostic: '#A855F7',
  modification: '#33D6D2',
};

const TYPES: { value: MaintenanceType; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'diagnostic', label: 'Diagnostic' },
  { value: 'modification', label: 'Modification' },
];

export default function MaintenanceDetailScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [record, setRecord] = useState<MaintenanceRecord | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<MaintenanceType>('routine');
  const [editDate, setEditDate] = useState('');
  const [editMileage, setEditMileage] = useState('');
  const [editPartsCost, setEditPartsCost] = useState('');
  const [editLaborCost, setEditLaborCost] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNextDate, setEditNextDate] = useState('');
  const [editNextMileage, setEditNextMileage] = useState('');
  const [editShopName, setEditShopName] = useState('');

  const loadRecord = useCallback(async () => {
    if (!user?.user_id || !id) return;
    setLoading(true);
    try {
      const [rec, vehicleRows] = await Promise.all([
        getMaintenanceRecordById(id, user.user_id),
        getUserVehicles(user.user_id),
      ]);
      setRecord(rec);
      setVehicles(vehicleRows);
      if (rec) {
        setEditTitle(rec.title);
        setEditType(rec.type);
        setEditDate(rec.date);
        setEditMileage(rec.mileage ? String(rec.mileage) : '');
        setEditPartsCost(rec.parts_cost ? String(rec.parts_cost) : '');
        setEditLaborCost(rec.labor_cost ? String(rec.labor_cost) : '');
        setEditDescription(rec.description || '');
        setEditNextDate(rec.next_service_date || '');
        setEditNextMileage(rec.next_service_mileage ? String(rec.next_service_mileage) : '');
        setEditShopName(rec.shop_name || '');
      }
    } catch (e) {
      console.warn('Error loading record:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id, id]);

  useEffect(() => { loadRecord(); }, [loadRecord]);

  const vehicleMap = new Map(vehicles.map((v) => [v.vehicle_id, `${v.year} ${v.make} ${v.model}`]));

  const handleSave = async () => {
    if (!user?.user_id || !record) return;
    setSaving(true);
    try {
      const editTotal =
        (parseFloat(editPartsCost) || 0) + (parseFloat(editLaborCost) || 0);
      const updated = await updateMaintenanceRecord(record.record_id, user.user_id, {
        title: editTitle.trim(),
        type: editType,
        date: editDate,
        mileage: editMileage ? parseInt(editMileage, 10) : undefined,
        parts_cost: editPartsCost ? parseFloat(editPartsCost) : undefined,
        labor_cost: editLaborCost ? parseFloat(editLaborCost) : undefined,
        cost: editTotal > 0 ? editTotal : record.cost,
        description: editDescription.trim() || undefined,
        shop_name: editShopName.trim() || undefined,
        next_service_date: editNextDate || undefined,
        next_service_mileage: editNextMileage ? parseInt(editNextMileage, 10) : undefined,
      });
      setRecord(updated);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this maintenance record? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.user_id || !record) return;
            setDeleting(true);
            try {
              await deleteMaintenanceRecord(record.record_id, user.user_id);
              router.replace('/maintenance');
            } catch (e: any) {
              Alert.alert('Delete failed', e?.message || 'Please try again.');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <AppShell routeKey="maintenance" title="Record Detail" subtitle="">
        <ActivityIndicator size="large" color={colors.brandAccent} style={{ marginTop: 60 }} />
      </AppShell>
    );
  }

  if (!record) {
    return (
      <AppShell routeKey="maintenance" title="Record Not Found" subtitle="">
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>Record not found or access denied.</Text>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonInteraction]} onPress={() => router.replace('/maintenance')}>
            <View style={styles.buttonContent}>
              <GearActionIcon size="sm" />
              <Text style={styles.primaryButtonText}>Back to Maintenance</Text>
            </View>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  const severityColor = getNextServiceColor(record.next_service_date);
  const typeColor = TYPE_COLORS[record.type] || colors.brandAccent;
  const editTotal = (parseFloat(editPartsCost) || 0) + (parseFloat(editLaborCost) || 0);

  return (
    <AppShell routeKey="maintenance" title="Service Record" subtitle={record.title}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {/* Header */}
          <View style={[styles.recordHeader, { borderLeftColor: severityColor }]}>
            <View style={{ flex: 1 }}>
              {editing ? (
                <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholderTextColor={colors.textSecondary} />
              ) : (
                <Text style={styles.recordTitle}>{record.title}</Text>
              )}
              <View style={styles.badgeRow}>
                <View style={[styles.typeBadge, { backgroundColor: typeColor + '33', borderColor: typeColor }]}>
                  <Text style={[styles.typeBadgeText, { color: typeColor }]}>{record.type}</Text>
                </View>
                {record.next_service_date && (
                  <View style={[styles.typeBadge, { backgroundColor: severityColor + '33', borderColor: severityColor }]}>
                    <Text style={[styles.typeBadgeText, { color: severityColor }]}>
                      Next: {formatDate(record.next_service_date)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.headerActions}>
              {!editing ? (
                <Pressable style={({ pressed }) => [styles.editButton, pressed && styles.buttonInteraction]} onPress={() => setEditing(true)}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable style={({ pressed }) => [styles.cancelEditButton, pressed && styles.buttonInteraction]} onPress={() => setEditing(false)}>
                    <Text style={styles.cancelEditText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.saveEditButton, pressed && styles.buttonInteraction]} onPress={handleSave} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <View style={styles.buttonContent}>
                        <GearActionIcon size="sm" />
                        <Text style={styles.saveEditText}>Save</Text>
                      </View>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {/* Vehicle + Date + Mileage */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Vehicle</Text>
              <Text style={styles.metaValue}>{vehicleMap.get(record.vehicle_id) || record.vehicle_id}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Date</Text>
              {editing ? (
                <TextInput style={styles.input} value={editDate} onChangeText={setEditDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
              ) : (
                <Text style={styles.metaValue}>{formatDate(record.date)}</Text>
              )}
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Mileage</Text>
              {editing ? (
                <TextInput style={styles.input} value={editMileage} onChangeText={setEditMileage} keyboardType="numeric" placeholder="--" placeholderTextColor={colors.textSecondary} />
              ) : (
                <Text style={styles.metaValue}>{record.mileage ? `${record.mileage.toLocaleString()} mi` : '--'}</Text>
              )}
            </View>
          </View>

          {/* Type selector in edit mode */}
          {editing && (
            <View style={styles.group}>
              <Text style={styles.metaLabel}>Type</Text>
              <View style={styles.chipRow}>
                {TYPES.map((opt) => {
                  const active = editType === opt.value;
                  return (
                    <Pressable key={opt.value} onPress={() => setEditType(opt.value)} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.buttonInteraction]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Cost breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cost Breakdown</Text>
            <View style={styles.costGrid}>
              {editing ? (
                <>
                  <View style={styles.costItem}>
                    <Text style={styles.metaLabel}>Parts</Text>
                    <TextInput style={styles.input} value={editPartsCost} onChangeText={setEditPartsCost} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSecondary} />
                  </View>
                  <View style={styles.costItem}>
                    <Text style={styles.metaLabel}>Labor</Text>
                    <TextInput style={styles.input} value={editLaborCost} onChangeText={setEditLaborCost} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSecondary} />
                  </View>
                  <View style={styles.costItem}>
                    <Text style={styles.metaLabel}>Total</Text>
                    <Text style={styles.totalValue}>{formatCurrency(editTotal)}</Text>
                  </View>
                </>
              ) : (
                <>
                  {record.parts_cost !== undefined && record.parts_cost !== null && (
                    <View style={styles.costItem}>
                      <Text style={styles.metaLabel}>Parts</Text>
                      <Text style={styles.metaValue}>{formatCurrency(record.parts_cost)}</Text>
                    </View>
                  )}
                  {record.labor_cost !== undefined && record.labor_cost !== null && (
                    <View style={styles.costItem}>
                      <Text style={styles.metaLabel}>Labor</Text>
                      <Text style={styles.metaValue}>{formatCurrency(record.labor_cost)}</Text>
                    </View>
                  )}
                  <View style={styles.costItem}>
                    <Text style={styles.metaLabel}>Total</Text>
                    <Text style={styles.totalValue}>{record.cost ? formatCurrency(record.cost) : '--'}</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {editing ? (
              <TextInput style={[styles.input, styles.notesInput]} value={editDescription} onChangeText={setEditDescription} multiline numberOfLines={4} placeholder="Add notes" placeholderTextColor={colors.textSecondary} />
            ) : (
              <Text style={styles.descText}>{record.description || 'No notes recorded.'}</Text>
            )}
          </View>

          {/* Parts replaced */}
          {record.parts_replaced && record.parts_replaced.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Parts Installed</Text>
              {record.parts_replaced.map((p, i) => (
                <View key={i} style={styles.listItem}>
                  <Text style={styles.listItemBullet}>•</Text>
                  <Text style={styles.listItemText}>{p}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Photo gallery */}
          {record.attachment_urls && record.attachment_urls.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Photos</Text>
              <View style={styles.photoGallery}>
                {record.attachment_urls.map((url, i) => (
                  <Image key={i} source={{ uri: url }} style={styles.galleryPhoto} />
                ))}
              </View>
            </View>
          )}

          {/* Shop info */}
          {(record.shop_name || editing) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Service Shop</Text>
              {editing ? (
                <TextInput style={styles.input} value={editShopName} onChangeText={setEditShopName} placeholder="Shop name" placeholderTextColor={colors.textSecondary} />
              ) : (
                <>
                  <Text style={styles.metaValue}>{record.shop_name}</Text>
                  {record.shop_location ? <Text style={styles.metaLabel}>{record.shop_location}</Text> : null}
                  {record.technician_name ? <Text style={styles.metaLabel}>Tech: {record.technician_name}</Text> : null}
                </>
              )}
            </View>
          )}

          {/* Next service */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Service</Text>
            {editing ? (
              <View style={styles.row}>
                <View style={[styles.group, { flex: 1 }]}>
                  <Text style={styles.metaLabel}>Date</Text>
                  <TextInput style={styles.input} value={editNextDate} onChangeText={setEditNextDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
                </View>
                <View style={[styles.group, { flex: 1 }]}>
                  <Text style={styles.metaLabel}>Mileage</Text>
                  <TextInput style={styles.input} value={editNextMileage} onChangeText={setEditNextMileage} keyboardType="numeric" placeholder="--" placeholderTextColor={colors.textSecondary} />
                </View>
              </View>
            ) : (
              <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Date</Text>
                  <Text style={[styles.metaValue, { color: severityColor }]}>
                    {record.next_service_date ? formatDate(record.next_service_date) : '--'}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Mileage</Text>
                  <Text style={[styles.metaValue, { color: severityColor }]}>
                    {record.next_service_mileage ? `${record.next_service_mileage.toLocaleString()} mi` : '--'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* DTC codes */}
          {record.dtc_codes && record.dtc_codes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DTC Codes</Text>
              <View style={styles.chipRow}>
                {record.dtc_codes.map((code) => (
                  <View key={code} style={styles.dtcBadge}>
                    <Text style={styles.dtcBadgeText}>{code}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Warranty */}
          {record.warranty_covered && (
            <View style={styles.warrantyBanner}>
              <Text style={styles.warrantyText}>Warranty Covered</Text>
            </View>
          )}

          {/* Delete */}
          {!editing && (
            <View style={styles.dangerZone}>
              <Pressable
                style={({ pressed }) => [styles.deleteButton, pressed && styles.buttonInteraction]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete Record</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 16 },
  notFoundText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.md, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, padding: 16, gap: 16, maxWidth: 840, width: '100%', alignSelf: 'center' },
  recordHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderLeftWidth: 4, paddingLeft: 12 },
  recordTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.xl },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  typeBadge: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 3 },
  typeBadgeText: { fontFamily: fontFamilies.body, fontSize: typeScale.xs, textTransform: 'capitalize' },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editButton: { minHeight: 36, borderWidth: 1, borderColor: colors.brandAccent, borderRadius: radii.md, paddingHorizontal: 14, justifyContent: 'center' },
  editButtonText: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  cancelEditButton: { minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 14, justifyContent: 'center' },
  cancelEditText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  saveEditButton: { minHeight: 36, backgroundColor: colors.brandAccent, borderRadius: radii.md, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  saveEditText: { color: colors.background, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { minWidth: 120, flex: 1, gap: 4 },
  metaLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  section: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
  sectionTitle: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textTransform: 'uppercase', letterSpacing: 1 },
  costGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  costItem: { minWidth: 100, flex: 1, gap: 4 },
  totalValue: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md },
  descText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, lineHeight: 22 },
  listItem: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  listItemBullet: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  listItemText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, flex: 1 },
  photoGallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  galleryPhoto: { width: 100, height: 100, borderRadius: radii.md },
  warrantyBanner: { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: '#10B981', borderRadius: radii.md, padding: 10, alignItems: 'center' },
  warrantyText: { color: '#10B981', fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  dangerZone: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, alignItems: 'flex-start' },
  deleteButton: { minHeight: 44, backgroundColor: '#EF4444', borderRadius: radii.md, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  group: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: radii.full, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  chipActive: { borderColor: colors.brandAccent, backgroundColor: 'rgba(51, 214, 210, 0.14)' },
  chipText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  chipTextActive: { color: colors.textPrimary },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, color: colors.textPrimary, paddingHorizontal: 12, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  notesInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
  dtcBadge: { borderWidth: 1, borderColor: colors.warning, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 3 },
  dtcBadgeText: { color: colors.warning, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  primaryButton: { minHeight: 44, borderRadius: radii.md, backgroundColor: colors.brandAccent, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  primaryButtonText: { color: colors.background, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonInteraction: { opacity: 0.88 },
});
