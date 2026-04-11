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
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import CalendarPicker from '../../components/CalendarPicker';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMaintenanceRecordById,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
} from '../../services/maintenance-service';
import { getUserVehicles } from '../../services/vehicle-service';
import type { MaintenanceRecord, MaintenanceType } from '../../types/maintenance';
import type { Vehicle } from '../../types/vehicle';
import { elevation, radii } from '../../theme/tokens';
import { fontFamilies, typeScale, fontWeights, letterSpacings } from '../../theme/typography';
import { sp, touchMinHeight, pressedOpacity } from '../../theme/spacing';
import { Button, Badge, ErrorBanner, OverlayBackdrop } from '../../components/ui';
import { useTheme } from '../../contexts/ThemeContext';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

function getNextServiceColor(
  colors: ReturnType<typeof useTheme>['colors'],
  nextDate?: string,
): string {
  if (!nextDate) return colors.border;
  const now = new Date();
  const next = new Date(nextDate);
  const daysUntil = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntil < 0) return colors.danger;
  if (daysUntil <= 30) return colors.warning;
  return colors.success;
}

const TYPES: { value: MaintenanceType; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'diagnostic', label: 'Diagnostic' },
  { value: 'modification', label: 'Modification' },
];

const TYPE_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'neutral' | 'danger'> = {
  routine: 'success',
  repair: 'warning',
  inspection: 'info',
  diagnostic: 'neutral',
  modification: 'neutral',
};

export default function MaintenanceDetailScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const typeColorMap: Record<string, string> = {
    routine: colors.success,
    repair: colors.warning,
    inspection: colors.actionAccent,
    diagnostic: '#A855F7', // no direct theme token
    modification: colors.brandAccent,
  };

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
  const [activeDatePicker, setActiveDatePicker] = useState<'editDate' | 'editNextDate' | null>(null);

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

  const handleDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setActiveDatePicker(null);
    if (selected) {
      const iso = selected.toISOString().split('T')[0];
      if (activeDatePicker === 'editDate') setEditDate(iso);
      else setEditNextDate(iso);
    }
  };

  const styles = makeStyles(colors);

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
          <Button title="Back to Maintenance" onPress={() => router.replace('/maintenance')} variant="primary" icon="arrow-back" />
        </View>
      </AppShell>
    );
  }

  const severityColor = getNextServiceColor(colors, record.next_service_date);
  const typeColor = typeColorMap[record.type] || colors.brandAccent;
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
                <Badge label={record.type} variant={TYPE_BADGE_VARIANT[record.type] ?? 'neutral'} color={typeColor} />
                {record.next_service_date && (
                  <Badge label={`Next: ${formatDate(record.next_service_date)}`} color={severityColor} />
                )}
              </View>
            </View>
            <View style={styles.headerActions}>
              {!editing ? (
                <Button title="Edit" onPress={() => setEditing(true)} variant="ghost" size="sm" />
              ) : (
                <>
                  <Button title="Cancel" onPress={() => setEditing(false)} variant="secondary" size="sm" />
                  <Button title="Save" onPress={handleSave} variant="primary" size="sm" icon="checkmark" disabled={saving} loading={saving} />
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
                <Pressable
                  style={({ pressed }) => [styles.input, styles.dateButton, { opacity: pressed ? pressedOpacity : 1 }]}
                  onPress={() => setActiveDatePicker('editDate')}
                  accessibilityRole="button"
                  accessibilityLabel="Select date"
                >
                  <Text style={editDate ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                    {editDate ? formatDate(editDate) : 'Tap to select date'}
                  </Text>
                  <Text style={styles.dateButtonIcon}>📅</Text>
                </Pressable>
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
                    <Pressable
                      key={opt.value}
                      onPress={() => setEditType(opt.value)}
                      style={({ pressed }) => [styles.chip, active && styles.chipActive, { opacity: pressed ? pressedOpacity : 1 }]}
                      accessibilityLabel={opt.label}
                    >
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
                  <Pressable
                    style={({ pressed }) => [styles.input, styles.dateButton, { opacity: pressed ? pressedOpacity : 1 }]}
                    onPress={() => setActiveDatePicker('editNextDate')}
                    accessibilityRole="button"
                    accessibilityLabel="Select date"
                  >
                    <Text style={editNextDate ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                      {editNextDate ? formatDate(editNextDate) : 'Tap to select date'}
                    </Text>
                    <Text style={styles.dateButtonIcon}>📅</Text>
                  </Pressable>
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
            <ErrorBanner message="Warranty Covered" variant="success" />
          )}

          {/* Delete */}
          {!editing && (
            <View style={styles.dangerZone}>
              <Button
                title="Delete Record"
                onPress={handleDelete}
                variant="danger"
                disabled={deleting}
                loading={deleting}
                accessibilityHint="Permanently delete this maintenance record"
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Date Picker (iOS: inline sheet; Android: native dialog; Web: custom calendar) ── */}
      {Platform.OS === 'web' && (
        <CalendarPicker
          visible={activeDatePicker !== null}
          value={activeDatePicker === 'editDate' ? editDate : editNextDate}
          onChange={(iso) => {
            if (activeDatePicker === 'editDate') setEditDate(iso);
            else setEditNextDate(iso);
            setActiveDatePicker(null);
          }}
          onClose={() => setActiveDatePicker(null)}
        />
      )}
      {Platform.OS === 'ios' && activeDatePicker !== null && (
        <Modal transparent animationType="slide" onRequestClose={() => setActiveDatePicker(null)}>
          <View style={styles.pickerOverlayWrapper}>
            <OverlayBackdrop onDismiss={() => setActiveDatePicker(null)} />
            <View style={styles.pickerSheet}>
              <View style={styles.pickerToolbar}>
                <Pressable onPress={() => setActiveDatePicker(null)} accessibilityLabel="Cancel">
                  <Text style={styles.pickerCancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.pickerTitle}>Select Date</Text>
                <Pressable onPress={() => setActiveDatePicker(null)} accessibilityLabel="Done">
                  <Text style={styles.pickerDone}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={
                  activeDatePicker === 'editDate'
                    ? (editDate ? new Date(editDate + 'T12:00:00') : new Date())
                    : (editNextDate ? new Date(editNextDate + 'T12:00:00') : new Date())
                }
                mode="date"
                display="inline"
                onChange={handleDateChange}
                themeVariant="dark"
                style={styles.pickerInline}
              />
            </View>
          </View>
        </Modal>
      )}
      {Platform.OS === 'android' && activeDatePicker !== null && (
        <DateTimePicker
          value={
            activeDatePicker === 'editDate'
              ? (editDate ? new Date(editDate + 'T12:00:00') : new Date())
              : (editNextDate ? new Date(editNextDate + 'T12:00:00') : new Date())
          }
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </AppShell>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: sp[4], paddingBottom: sp[10] },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: sp[5], gap: sp[4] },
    notFoundText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.md, textAlign: 'center' },
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, padding: sp[4], gap: sp[4], maxWidth: 840, width: '100%', alignSelf: 'center' },
    recordHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: sp[3], borderLeftWidth: 4, paddingLeft: sp[3] },
    recordTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.xl },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[2], marginTop: sp[2] },
    headerActions: { flexDirection: 'row', gap: sp[2], alignItems: 'center' },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[3] },
    metaItem: { minWidth: 120, flex: 1, gap: sp[1] },
    metaLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textTransform: 'uppercase', letterSpacing: letterSpacings.wide },
    metaValue: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
    section: { gap: sp[2], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: sp[3] },
    sectionTitle: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textTransform: 'uppercase', letterSpacing: letterSpacings.widest },
    costGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[4] },
    costItem: { minWidth: 100, flex: 1, gap: sp[1] },
    totalValue: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md },
    descText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, lineHeight: 22 },
    listItem: { flexDirection: 'row', gap: sp[2], alignItems: 'flex-start' },
    listItemBullet: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
    listItemText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, flex: 1 },
    photoGallery: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[2] },
    galleryPhoto: { width: 100, height: 100, borderRadius: radii.md },
    dangerZone: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: sp[4], alignItems: 'flex-start' },
    group: { gap: sp[1] },
    row: { flexDirection: 'row', gap: sp[2], flexWrap: 'wrap' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[2] },
    chip: { minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: radii.full, backgroundColor: colors.surfaceAlt, paddingHorizontal: sp[3], justifyContent: 'center', alignItems: 'center' },
    chipActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
    chipText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    chipTextActive: { color: colors.textPrimary },
    input: { minHeight: touchMinHeight, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, color: colors.textPrimary, paddingHorizontal: sp[3], fontFamily: fontFamilies.body, fontSize: typeScale.sm },
    notesInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: sp[2] },
    dtcBadge: { borderWidth: 1, borderColor: colors.warning, borderRadius: radii.sm, paddingHorizontal: sp[2], paddingVertical: sp[1] },
    dtcBadgeText: { color: colors.warning, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateButtonText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
    dateButtonPlaceholder: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
    dateButtonIcon: { fontSize: 16 },
    pickerOverlayWrapper: { flex: 1, justifyContent: 'flex-end' },
    pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, paddingBottom: sp[8] },
    pickerToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: sp[5], paddingVertical: sp[3], borderBottomWidth: 1, borderBottomColor: colors.border },
    pickerTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md },
    pickerCancel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.md },
    pickerDone: { color: colors.brandAccent, fontFamily: fontFamilies.heading, fontSize: typeScale.md },
    pickerInline: { alignSelf: 'center' },
  });
}
