import React, { useEffect, useState } from 'react';
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
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import GearActionIcon from '../../components/branding/GearActionIcon';
import AppShell from '../../components/layout/AppShell';
import CalendarPicker from '../../components/CalendarPicker';
import { useAuth } from '../../contexts/AuthContext';
import {
  createMaintenanceRecord,
  getServiceProviders,
} from '../../services/maintenance-service';
import { getUserVehicles } from '../../services/vehicle-service';
import { supabase } from '../../lib/supabase';
import type { MaintenanceTemplate, MaintenanceType, ServiceProvider } from '../../types/maintenance';
import type { Vehicle } from '../../types/vehicle';
import { radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';
import { useTheme } from '../../contexts/ThemeContext';

const TYPES: { value: MaintenanceType; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'diagnostic', label: 'Diagnostic' },
  { value: 'modification', label: 'Modification' },
];

/** Extended template with per-category cost averages sourced from national service data */
interface LocalTemplate extends MaintenanceTemplate {
  est_parts_cost: number;
  est_labor_cost: number;
  est_tax_rate: number; // percentage, e.g. 8 for 8%
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const TEMPLATES: LocalTemplate[] = [
  { id: 'oil_change', title: 'Oil Change', type: 'routine', description: 'Engine oil and filter replacement', default_parts: ['Oil Filter', 'Engine Oil (5 qt)'], estimated_cost_min: 35, estimated_cost_max: 85, interval_miles: 5000, interval_months: 6, est_parts_cost: 30, est_labor_cost: 25, est_tax_rate: 8 },
  { id: 'tire_rotation', title: 'Tire Rotation', type: 'routine', description: 'Rotate tires to equalize wear', estimated_cost_min: 20, estimated_cost_max: 60, interval_miles: 7500, interval_months: 6, est_parts_cost: 0, est_labor_cost: 35, est_tax_rate: 0 },
  { id: 'brake_pads', title: 'Brake Pads', type: 'repair', description: 'Front and/or rear brake pad replacement', default_parts: ['Front Brake Pads', 'Rear Brake Pads'], estimated_cost_min: 150, estimated_cost_max: 400, interval_miles: 40000, interval_months: 48, est_parts_cost: 120, est_labor_cost: 130, est_tax_rate: 8 },
  { id: 'air_filter', title: 'Air Filter', type: 'routine', description: 'Engine air filter replacement', default_parts: ['Engine Air Filter'], estimated_cost_min: 20, estimated_cost_max: 50, interval_miles: 15000, interval_months: 12, est_parts_cost: 25, est_labor_cost: 15, est_tax_rate: 8 },
  { id: 'transmission_fluid', title: 'Transmission Fluid', type: 'routine', description: 'Transmission fluid flush and fill', default_parts: ['Transmission Fluid'], estimated_cost_min: 100, estimated_cost_max: 250, interval_miles: 60000, interval_months: 48, est_parts_cost: 60, est_labor_cost: 100, est_tax_rate: 8 },
  { id: 'coolant_flush', title: 'Coolant Flush', type: 'routine', description: 'Cooling system flush and new coolant', default_parts: ['Coolant/Antifreeze'], estimated_cost_min: 100, estimated_cost_max: 200, interval_miles: 30000, interval_months: 24, est_parts_cost: 30, est_labor_cost: 100, est_tax_rate: 8 },
  { id: 'spark_plugs', title: 'Spark Plugs', type: 'routine', description: 'Spark plug replacement', default_parts: ['Spark Plugs (set)'], estimated_cost_min: 100, estimated_cost_max: 300, interval_miles: 60000, interval_months: 60, est_parts_cost: 80, est_labor_cost: 100, est_tax_rate: 8 },
  { id: 'battery', title: 'Battery', type: 'repair', description: 'Battery replacement', default_parts: ['Car Battery'], estimated_cost_min: 100, estimated_cost_max: 250, interval_months: 48, est_parts_cost: 130, est_labor_cost: 40, est_tax_rate: 8 },
  { id: 'alignment', title: 'Wheel Alignment', type: 'routine', description: 'Four-wheel alignment service', estimated_cost_min: 75, estimated_cost_max: 200, interval_miles: 20000, interval_months: 24, est_parts_cost: 0, est_labor_cost: 125, est_tax_rate: 8 },
];

export default function MaintenanceNewScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [shops, setShops] = useState<ServiceProvider[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [vehicleId, setVehicleId] = useState('');
  const [type, setType] = useState<MaintenanceType>('routine');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mileage, setMileage] = useState('');
  const [description, setDescription] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [tax, setTax] = useState('');
  const [inlineParts, setInlineParts] = useState<string[]>([]);
  const [newPartName, setNewPartName] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [nextServiceMileage, setNextServiceMileage] = useState('');
  const [selectedShopId, setSelectedShopId] = useState<string>('');

  // Date picker & template modal state
  const [activeDatePicker, setActiveDatePicker] = useState<'date' | 'nextDate' | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const totalCost =
    (parseFloat(partsCost) || 0) + (parseFloat(laborCost) || 0) + (parseFloat(tax) || 0);

  useEffect(() => {
    if (!user?.user_id) return;
    setVehiclesLoading(true);
    Promise.all([
      getUserVehicles(user.user_id),
      getServiceProviders(user.user_id).catch(() => [] as ServiceProvider[]),
    ])
      .then(([vehicleRows, shopRows]) => {
        setVehicles(vehicleRows);
        setShops(shopRows);
        if (vehicleRows[0]) setVehicleId(vehicleRows[0].vehicle_id);
      })
      .catch((e) => console.warn('Could not load data:', e))
      .finally(() => setVehiclesLoading(false));
  }, [user?.user_id]);

  const applyTemplate = (tpl: LocalTemplate) => {
    setTitle(tpl.title);
    setType(tpl.type);
    setDescription(tpl.description);
    if (tpl.default_parts) setInlineParts(tpl.default_parts);
    setPartsCost(tpl.est_parts_cost > 0 ? tpl.est_parts_cost.toFixed(2) : '');
    setLaborCost(tpl.est_labor_cost > 0 ? tpl.est_labor_cost.toFixed(2) : '');
    const taxAmt = (tpl.est_parts_cost + tpl.est_labor_cost) * (tpl.est_tax_rate / 100);
    setTax(taxAmt > 0 ? taxAmt.toFixed(2) : '');
    setShowTemplateModal(false);
  };

  /** Prompt user to use the selected vehicle's recorded mileage instead of typing. */
  const handleMileageFocus = () => {
    const vehicle = vehicles.find((v) => v.vehicle_id === vehicleId);
    if (vehicle?.current_mileage && !mileage) {
      Alert.alert(
        'Use Current Mileage?',
        `Your ${vehicle.year} ${vehicle.make} ${vehicle.model} has ${vehicle.current_mileage.toLocaleString()} mi on record. Auto-fill this?`,
        [
          { text: 'Enter Manually', style: 'cancel' },
          { text: 'Use Current', onPress: () => setMileage(String(vehicle.current_mileage)) },
        ]
      );
    }
  };

  /** Handle date picker change on both iOS and Android */
  const handleDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setActiveDatePicker(null);
    if (selected) {
      const iso = selected.toISOString().split('T')[0];
      if (activeDatePicker === 'date') setDate(iso);
      else setNextServiceDate(iso);
    }
  };

  const handleAddPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setPhotoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (photoUris.length === 0) return [];
    setUploadingPhotos(true);
    const urls: string[] = [];
    try {
      for (const uri of photoUris) {
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const resp = await fetch(uri);
        const blob = await resp.blob();
        const { error } = await supabase.storage
          .from('maintenance-photos')
          .upload(fileName, blob, { contentType: 'image/jpeg' });
        if (!error) {
          const { data } = supabase.storage.from('maintenance-photos').getPublicUrl(fileName);
          urls.push(data.publicUrl);
        }
      }
    } finally {
      setUploadingPhotos(false);
    }
    return urls;
  };

  const handleSave = async () => {
    if (!user?.user_id) { Alert.alert('Authentication required', 'Please sign in.'); return; }
    if (!vehicleId) { Alert.alert('Missing vehicle', 'Choose a vehicle first.'); return; }
    if (!title.trim()) { Alert.alert('Missing title', 'Please enter a service title.'); return; }
    setSaving(true);
    try {
      const uploadedUrls = await uploadPhotos();
      const selectedShop = shops.find((s) => s.provider_id === selectedShopId);
      await createMaintenanceRecord(vehicleId, user.user_id, {
        type,
        title: title.trim(),
        date,
        mileage: mileage ? parseInt(mileage, 10) : undefined,
        cost: totalCost > 0 ? totalCost : undefined,
        labor_cost: laborCost ? parseFloat(laborCost) : undefined,
        parts_cost: partsCost ? parseFloat(partsCost) : undefined,
        description: description.trim() || undefined,
        shop_name: selectedShop?.name,
        shop_location: selectedShop?.address,
        parts_replaced: inlineParts.filter(Boolean),
        photos: uploadedUrls,
        next_service_date: nextServiceDate || undefined,
        next_service_mileage: nextServiceMileage ? parseInt(nextServiceMileage, 10) : undefined,
      });
      router.replace('/maintenance');
    } catch (error: any) {
      Alert.alert('Unable to save', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, padding: 16, gap: 12, maxWidth: 840, width: '100%', alignSelf: 'center' },
    cardTitle: { color: colors.textPrimary, fontSize: typeScale.lg, fontFamily: fontFamilies.heading },
    group: { gap: 6 },
    label: { color: colors.textSecondary, fontSize: typeScale.sm, fontFamily: fontFamilies.body },
    input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, color: colors.textPrimary, paddingHorizontal: 12, fontFamily: fontFamilies.body, fontSize: typeScale.md },
    notesInput: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    column: { minWidth: 160, flex: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: radii.full, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
    chipActive: { borderColor: colors.brandAccent, backgroundColor: 'rgba(51, 214, 210, 0.14)' },
    chipText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    chipTextActive: { color: colors.textPrimary },
    tplChip: { minHeight: 56, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', gap: 2 },
    tplChipText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    tplChipSub: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 10 },
    sectionDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 4 },
    sectionLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textTransform: 'uppercase', letterSpacing: 1 },
    totalRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
    totalLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
    totalValue: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md },
    inlinePartRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: { padding: 8, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt },
    iconBtnText: { color: colors.textSecondary, fontSize: typeScale.xs },
    addPartButton: { minHeight: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.brandAccent, paddingHorizontal: 12, justifyContent: 'center' },
    addPartButtonText: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
    photoThumb: { width: 72, height: 72, borderRadius: radii.md, overflow: 'hidden', position: 'relative' },
    photoImage: { width: 72, height: 72 },
    photoRemove: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
    photoRemoveText: { color: '#fff', fontSize: 10 },
    addPhotoButton: { minHeight: 72, minWidth: 72, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
    addPhotoButtonText: { color: colors.brandAccent, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 8 },
    primaryButton: { minHeight: 44, borderRadius: radii.md, backgroundColor: colors.brandAccent, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
    saveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    primaryButtonText: { color: colors.background, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
    secondaryButton: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
    secondaryButtonText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
    buttonDisabled: { opacity: 0.6 },
    buttonInteraction: { opacity: 0.92 },
    dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateButtonText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.md },
    dateButtonPlaceholder: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.md },
    dateButtonIcon: { fontSize: 16 },
    pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, paddingBottom: 32 },
    pickerToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    pickerTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md },
    pickerCancel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.md },
    pickerDone: { color: colors.brandAccent, fontFamily: fontFamilies.heading, fontSize: typeScale.md },
    pickerInline: { alignSelf: 'center' },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.lg },
    modalCloseBtn: { width: 32, height: 32, borderRadius: radii.full, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    modalCloseBtnText: { color: colors.textSecondary, fontSize: 14 },
    modalSubtitle: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, paddingHorizontal: 20, paddingVertical: 10 },
    modalList: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
    templateCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, padding: 14, gap: 6 },
    templateCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    templateCardTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.md, flex: 1 },
    templateCardDesc: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
    templateCostRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4, alignItems: 'center' },
    templateCostItem: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    templateCostValue: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
    templateCostTotal: { color: colors.brandAccent, fontFamily: fontFamilies.heading, fontSize: typeScale.sm, marginLeft: 'auto' },
    templateParts: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 11, marginTop: 2 },
    typeBadge: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 2 },
    typeBadgeText: { fontFamily: fontFamilies.body, fontSize: 10, textTransform: 'capitalize' },
  });

  return (
    <AppShell routeKey="maintenance-new" title="New Maintenance Record" subtitle="Log service activity">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New Service Record</Text>

          {/* Template selector */}
          <View style={styles.group}>
            <Text style={styles.label}>Quick Template</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {TEMPLATES.map((tpl) => (
                  <Pressable key={tpl.id} accessibilityRole="button" onPress={() => applyTemplate(tpl)} style={({ pressed }) => [styles.tplChip, pressed && styles.buttonInteraction]}>
                    <Text style={styles.tplChipText}>{tpl.title}</Text>
                    <Text style={styles.tplChipSub}>${tpl.estimated_cost_min}-{tpl.estimated_cost_max}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Vehicle */}
          <View style={styles.group}>
            <Text style={styles.label}>Vehicle *</Text>
            {vehiclesLoading ? (
              <ActivityIndicator size="small" color={colors.brandAccent} />
            ) : (
              <View style={styles.chipRow}>
                {vehicles.map((v) => {
                  const active = vehicleId === v.vehicle_id;
                  return (
                    <Pressable key={v.vehicle_id} accessibilityRole="button" onPress={() => setVehicleId(v.vehicle_id)} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.buttonInteraction]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{v.year} {v.make} {v.model}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Type */}
          <View style={styles.group}>
            <Text style={styles.label}>Type *</Text>
            <View style={styles.chipRow}>
              {TYPES.map((opt) => {
                const active = type === opt.value;
                return (
                  <Pressable key={opt.value} accessibilityRole="button" onPress={() => setType(opt.value)} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.buttonInteraction]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Title */}
          <View style={styles.group}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Tap to pick a template or type..."
              placeholderTextColor={colors.textSecondary}
              onFocus={() => { if (!title) setShowTemplateModal(true); }}
            />
          </View>

          {/* Date + Mileage */}
          <View style={styles.row}>
            <View style={[styles.group, styles.column]}>
              <Text style={styles.label}>Date *</Text>
              <Pressable
                style={({ pressed }) => [styles.input, styles.dateButton, pressed && styles.buttonInteraction]}
                onPress={() => setActiveDatePicker('date')}
                accessibilityRole="button"
              >
                <Text style={date ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                  {date ? formatDisplayDate(date) : 'Select date'}
                </Text>
                <Text style={styles.dateButtonIcon}>📅</Text>
              </Pressable>
            </View>
            <View style={[styles.group, styles.column]}>
              <Text style={styles.label}>Mileage</Text>
              <TextInput
                style={styles.input}
                value={mileage}
                onChangeText={setMileage}
                keyboardType="numeric"
                placeholder="30500"
                placeholderTextColor={colors.textSecondary}
                onFocus={handleMileageFocus}
              />
            </View>
          </View>

          {/* Cost breakdown */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionLabel}>Cost Breakdown</Text>
          </View>
          <View style={styles.row}>
            <View style={[styles.group, styles.column]}>
              <Text style={styles.label}>Parts Cost</Text>
              <TextInput style={styles.input} value={partsCost} onChangeText={setPartsCost} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSecondary} />
            </View>
            <View style={[styles.group, styles.column]}>
              <Text style={styles.label}>Labor Cost</Text>
              <TextInput style={styles.input} value={laborCost} onChangeText={setLaborCost} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSecondary} />
            </View>
            <View style={[styles.group, styles.column]}>
              <Text style={styles.label}>Tax</Text>
              <TextInput style={styles.input} value={tax} onChangeText={setTax} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSecondary} />
            </View>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${totalCost.toFixed(2)}</Text>
          </View>

          {/* Notes */}
          <View style={styles.group}>
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.notesInput]} value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholder="Add any useful details" placeholderTextColor={colors.textSecondary} />
          </View>

          {/* Parts installed */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionLabel}>Parts Installed</Text>
          </View>
          {inlineParts.map((p, i) => (
            <View key={i} style={styles.inlinePartRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={p}
                onChangeText={(v) => setInlineParts((prev) => { const next = [...prev]; next[i] = v; return next; })}
                placeholder="Part name"
                placeholderTextColor={colors.textSecondary}
              />
              <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.buttonInteraction]} onPress={() => setInlineParts((prev) => prev.filter((_, idx) => idx !== i))}>
                <Text style={styles.iconBtnText}>x</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.inlinePartRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={newPartName} onChangeText={setNewPartName} placeholder="Add part name" placeholderTextColor={colors.textSecondary} />
            <Pressable style={({ pressed }) => [styles.addPartButton, pressed && styles.buttonInteraction]} onPress={() => { if (newPartName.trim()) { setInlineParts((prev) => [...prev, newPartName.trim()]); setNewPartName(''); } }}>
              <Text style={styles.addPartButtonText}>+ Add</Text>
            </Pressable>
          </View>

          {/* Photos */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionLabel}>Photos</Text>
          </View>
          <View style={styles.photoRow}>
            {photoUris.map((uri, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoImage} />
                <Pressable style={styles.photoRemove} onPress={() => setPhotoUris((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Text style={styles.photoRemoveText}>x</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={({ pressed }) => [styles.addPhotoButton, pressed && styles.buttonInteraction]} onPress={handleAddPhotos}>
              <Text style={styles.addPhotoButtonText}>+ Photos</Text>
            </Pressable>
          </View>
          {uploadingPhotos && <ActivityIndicator size="small" color={colors.brandAccent} />}

          {/* Next service */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionLabel}>Next Service</Text>
          </View>
          <View style={styles.row}>
            <View style={[styles.group, styles.column]}>
              <Text style={styles.label}>Next Service Date</Text>
              <Pressable
                style={({ pressed }) => [styles.input, styles.dateButton, pressed && styles.buttonInteraction]}
                onPress={() => setActiveDatePicker('nextDate')}
                accessibilityRole="button"
              >
                <Text style={nextServiceDate ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                  {nextServiceDate ? formatDisplayDate(nextServiceDate) : 'Select date'}
                </Text>
                <Text style={styles.dateButtonIcon}>📅</Text>
              </Pressable>
            </View>
            <View style={[styles.group, styles.column]}>
              <Text style={styles.label}>Next Service Mileage</Text>
              <TextInput style={styles.input} value={nextServiceMileage} onChangeText={setNextServiceMileage} keyboardType="numeric" placeholder="35000" placeholderTextColor={colors.textSecondary} />
            </View>
          </View>

          {/* Shop selector */}
          {shops.length > 0 && (
            <>
              <View style={styles.sectionDivider}>
                <Text style={styles.sectionLabel}>Service Shop</Text>
              </View>
              <View style={styles.chipRow}>
                <Pressable onPress={() => setSelectedShopId('')} style={({ pressed }) => [styles.chip, !selectedShopId && styles.chipActive, pressed && styles.buttonInteraction]}>
                  <Text style={[styles.chipText, !selectedShopId && styles.chipTextActive]}>None</Text>
                </Pressable>
                {shops.map((shop) => {
                  const active = selectedShopId === shop.provider_id;
                  return (
                    <Pressable key={shop.provider_id} onPress={() => setSelectedShopId(shop.provider_id)} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.buttonInteraction]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{shop.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonInteraction]} onPress={() => router.back()}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonInteraction, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <View style={styles.saveRow}>
                  <GearActionIcon size="sm" />
                  <Text style={styles.primaryButtonText}>Save Record</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* ── Service Template Picker Modal ── */}
      <Modal visible={showTemplateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTemplateModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose a Template</Text>
            <Pressable onPress={() => setShowTemplateModal(false)} style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.buttonInteraction]}>
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.modalSubtitle}>Average costs based on national service data. All fields editable after selection.</Text>
          <ScrollView contentContainerStyle={styles.modalList}>
            {TEMPLATES.map((tpl) => {
              const subtotal = tpl.est_parts_cost + tpl.est_labor_cost;
              const taxAmt = subtotal * tpl.est_tax_rate / 100;
              const total = subtotal + taxAmt;
              return (
                <Pressable
                  key={tpl.id}
                  style={({ pressed }) => [styles.templateCard, pressed && styles.buttonInteraction]}
                  onPress={() => applyTemplate(tpl)}
                  accessibilityRole="button"
                >
                  <View style={styles.templateCardHeader}>
                    <Text style={styles.templateCardTitle}>{tpl.title}</Text>
                    <View style={[styles.typeBadge, { borderColor: tpl.type === 'repair' ? colors.warning : colors.brandAccent }]}>
                      <Text style={[styles.typeBadgeText, { color: tpl.type === 'repair' ? colors.warning : colors.brandAccent }]}>{tpl.type}</Text>
                    </View>
                  </View>
                  <Text style={styles.templateCardDesc}>{tpl.description}</Text>
                  <View style={styles.templateCostRow}>
                    {tpl.est_parts_cost > 0 && <Text style={styles.templateCostItem}>Parts: <Text style={styles.templateCostValue}>${tpl.est_parts_cost}</Text></Text>}
                    {tpl.est_labor_cost > 0 && <Text style={styles.templateCostItem}>Labor: <Text style={styles.templateCostValue}>${tpl.est_labor_cost}</Text></Text>}
                    {tpl.est_tax_rate > 0 && <Text style={styles.templateCostItem}>Tax ({tpl.est_tax_rate}%): <Text style={styles.templateCostValue}>${taxAmt.toFixed(0)}</Text></Text>}
                    <Text style={styles.templateCostTotal}>≈${total.toFixed(0)} total</Text>
                  </View>
                  {tpl.default_parts && tpl.default_parts.length > 0 && (
                    <Text style={styles.templateParts}>{tpl.default_parts.join(' · ')}</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Date Picker (iOS: inline sheet; Android: native dialog; Web: custom calendar) ── */}
      {Platform.OS === 'web' && (
        <CalendarPicker
          visible={activeDatePicker !== null}
          value={activeDatePicker === 'date' ? date : nextServiceDate}
          onChange={(iso) => {
            if (activeDatePicker === 'date') setDate(iso);
            else setNextServiceDate(iso);
            setActiveDatePicker(null);
          }}
          onClose={() => setActiveDatePicker(null)}
        />
      )}
      {Platform.OS === 'ios' && activeDatePicker !== null && (
        <Modal transparent animationType="slide" onRequestClose={() => setActiveDatePicker(null)}>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerToolbar}>
                <Pressable onPress={() => setActiveDatePicker(null)}>
                  <Text style={styles.pickerCancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.pickerTitle}>Select Date</Text>
                <Pressable onPress={() => setActiveDatePicker(null)}>
                  <Text style={styles.pickerDone}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={
                  activeDatePicker === 'date'
                    ? (date ? new Date(date + 'T12:00:00') : new Date())
                    : (nextServiceDate ? new Date(nextServiceDate + 'T12:00:00') : new Date())
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
            activeDatePicker === 'date'
              ? (date ? new Date(date + 'T12:00:00') : new Date())
              : (nextServiceDate ? new Date(nextServiceDate + 'T12:00:00') : new Date())
          }
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </AppShell>
  );
}
