import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { decodeVIN } from '../services/vin-decoder';

interface AddVehicleModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (vehicle: { make: string; model: string; year: number; vin?: string; mileage?: number }) => void | Promise<void>;
}

export default function AddVehicleModal({ visible, onClose, onAdd }: AddVehicleModalProps) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vin, setVin] = useState('');
  const [mileage, setMileage] = useState('');
  const [saving, setSaving] = useState(false);
  const [decoding, setDecoding] = useState(false);

  const handleVinChange = async (text: string) => {
    const upper = text.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    setVin(upper);
    if (upper.length === 17) {
      setDecoding(true);
      try {
        const result = await decodeVIN(upper);
        if (result.make) setMake(result.make);
        if (result.model) setModel(result.model);
        if (result.year) setYear(String(result.year));
      } catch {
        // VIN decode failed silently — user can fill fields manually
      } finally {
        setDecoding(false);
      }
    }
  };

  const handleAdd = async () => {
    if (!make || !model || !year) {
      Alert.alert('Error', 'Please fill in Make, Model, and Year (or enter a valid VIN to auto-fill)');
      return;
    }
    
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      Alert.alert('Error', 'Please enter a valid year');
      return;
    }

    const mileageNum = mileage ? parseInt(mileage) : undefined;
    if (mileage && (isNaN(mileageNum!) || mileageNum! < 0)) {
      Alert.alert('Error', 'Please enter a valid mileage');
      return;
    }

    setSaving(true);
    try {
      await onAdd({ make, model, year: yearNum, vin: vin || undefined, mileage: mileageNum });
      setMake('');
      setModel('');
      setYear('');
      setVin('');
      setMileage('');
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add vehicle');
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
          <Text style={styles.title}>Add Vehicle</Text>
          <TouchableOpacity onPress={handleAdd} disabled={saving || decoding}>
            {saving ? <ActivityIndicator size="small" color="#007AFF" /> : <Text style={styles.saveButton}>Save</Text>}
          </TouchableOpacity>
        </View>
        
        <View style={styles.form}>
          <Text style={styles.label}>VIN <Text style={styles.vinHint}>(auto-fills vehicle info)</Text></Text>
          <View style={styles.vinRow}>
            <TextInput
              style={[styles.input, styles.vinInput]}
              value={vin}
              onChangeText={handleVinChange}
              placeholder="Enter 17-character VIN"
              maxLength={17}
              autoCapitalize="characters"
            />
            {decoding && <ActivityIndicator size="small" color="#007AFF" style={styles.vinSpinner} />}
          </View>

          <Text style={styles.label}>Make *</Text>
          <TextInput
            style={styles.input}
            value={make}
            onChangeText={setMake}
            placeholder="e.g., Toyota"
          />
          
          <Text style={styles.label}>Model *</Text>
          <TextInput
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholder="e.g., Camry"
          />
          
          <Text style={styles.label}>Year *</Text>
          <TextInput
            style={styles.input}
            value={year}
            onChangeText={setYear}
            placeholder="e.g., 2023"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Mileage (Optional)</Text>
          <TextInput
            style={styles.input}
            value={mileage}
            onChangeText={setMileage}
            placeholder="e.g., 25000"
            keyboardType="numeric"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  vinHint: {
    fontSize: 13,
    fontWeight: '400',
    color: '#007AFF',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  vinRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vinInput: {
    flex: 1,
  },
  vinSpinner: {
    marginLeft: 10,
  },
});
