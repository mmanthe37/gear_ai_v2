import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Vehicle } from '../types/vehicle';
import type { MaintenanceFormData, MaintenanceType } from '../types/maintenance';

interface AddMaintenanceModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (vehicleId: string, data: MaintenanceFormData) => Promise<void>;
  vehicles: Pick<Vehicle, 'vehicle_id' | 'make' | 'model' | 'year'>[];
}

const TYPES: { value: MaintenanceType; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'diagnostic', label: 'Diagnostic' },
  { value: 'modification', label: 'Modification' },
];

export default function AddMaintenanceModal({ visible, onClose, onAdd, vehicles }: AddMaintenanceModalProps) {
  const [vehicleId, setVehicleId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MaintenanceType>('routine');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mileage, setMileage] = useState('');
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setVehicleId('');
    setTitle('');
    setType('routine');
    setDate(new Date().toISOString().split('T')[0]);
    setMileage('');
    setCost('');
    setDescription('');
  };

  const handleSave = async () => {
    if (!vehicleId) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    setSaving(true);
    try {
      await onAdd(vehicleId, {
        type,
        title: title.trim(),
        date,
        mileage: mileage ? parseInt(mileage) : undefined,
        cost: cost ? parseFloat(cost) : undefined,
        description: description.trim() || undefined,
      });
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Service Record</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#007AFF" /> : <Text style={styles.saveBtn}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          {/* Vehicle selector */}
          <Text style={styles.label}>Vehicle *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {vehicles.map((v) => (
              <TouchableOpacity
                key={v.vehicle_id}
                style={[styles.chip, vehicleId === v.vehicle_id && styles.chipActive]}
                onPress={() => setVehicleId(v.vehicle_id)}
              >
                <Text style={[styles.chipText, vehicleId === v.vehicle_id && styles.chipTextActive]}>
                  {v.year} {v.make} {v.model}
                </Text>
              </TouchableOpacity>
            ))}
            {vehicles.length === 0 && (
              <Text style={styles.noVehicles}>No vehicles — add one first</Text>
            )}
          </ScrollView>

          {/* Type selector */}
          <Text style={styles.label}>Type *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.chip, type === t.value && styles.chipActive]}
                onPress={() => setType(t.value)}
              >
                <Text style={[styles.chipText, type === t.value && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Title *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g., Oil Change" />

          <Text style={styles.label}>Date *</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />

          <Text style={styles.label}>Mileage (Optional)</Text>
          <TextInput style={styles.input} value={mileage} onChangeText={setMileage} placeholder="e.g., 30000" keyboardType="numeric" />

          <Text style={styles.label}>Total Cost (Optional)</Text>
          <TextInput style={styles.input} value={cost} onChangeText={setCost} placeholder="e.g., 75.00" keyboardType="decimal-pad" />

          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Any additional notes..."
            multiline
            numberOfLines={3}
          />

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  saveBtn: { fontSize: 16, fontWeight: '600', color: '#007AFF' },
  form: { padding: 16 },
  label: { fontSize: 15, fontWeight: '500', color: '#333', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e8e8e8',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  chipTextActive: { color: '#fff' },
  noVehicles: { fontSize: 13, color: '#999', paddingVertical: 8 },
});
