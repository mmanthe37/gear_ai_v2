import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { decodeVIN } from '../services/vin-decoder';
import { useTheme } from '../contexts/ThemeContext';
import { sp } from '../theme/spacing';
import { typeScale, fontWeights } from '../theme/typography';
import { radii } from '../theme/tokens';

interface AddVehicleModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (vehicle: { make: string; model: string; year: number; vin?: string; mileage?: number }) => void | Promise<void>;
}

export default function AddVehicleModal({ visible, onClose, onAdd }: AddVehicleModalProps) {
  const { colors } = useTheme();
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
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={modalStyles.title}>Add Vehicle</Text>
          <TouchableOpacity onPress={handleAdd} disabled={saving || decoding} accessibilityLabel="Save vehicle">
            {saving ? <ActivityIndicator size="small" color={colors.actionAccent} /> : <Text style={modalStyles.saveButton}>Save</Text>}
          </TouchableOpacity>
        </View>
        
        <View style={modalStyles.form}>
          <Text style={modalStyles.label}>VIN <Text style={modalStyles.vinHint}>(auto-fills vehicle info)</Text></Text>
          <View style={modalStyles.vinRow}>
            <TextInput
              style={[modalStyles.input, modalStyles.vinInput]}
              value={vin}
              onChangeText={handleVinChange}
              placeholder="Enter 17-character VIN"
              maxLength={17}
              autoCapitalize="characters"
            />
            {decoding && <ActivityIndicator size="small" color={colors.actionAccent} style={modalStyles.vinSpinner} />}
          </View>

          <Text style={modalStyles.label}>Make *</Text>
          <TextInput
            style={modalStyles.input}
            value={make}
            onChangeText={setMake}
            placeholder="e.g., Toyota"
          />
          
          <Text style={modalStyles.label}>Model *</Text>
          <TextInput
            style={modalStyles.input}
            value={model}
            onChangeText={setModel}
            placeholder="e.g., Camry"
          />
          
          <Text style={modalStyles.label}>Year *</Text>
          <TextInput
            style={modalStyles.input}
            value={year}
            onChangeText={setYear}
            placeholder="e.g., 2023"
            keyboardType="numeric"
          />

          <Text style={modalStyles.label}>Mileage (Optional)</Text>
          <TextInput
            style={modalStyles.input}
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

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: sp[4],
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: typeScale.lg,
    fontWeight: fontWeights.semibold,
    color: '#333',
  },
  saveButton: {
    fontSize: typeScale.md,
    fontWeight: fontWeights.semibold,
    color: '#007AFF',
  },
  form: {
    padding: sp[4],
  },
  label: {
    fontSize: typeScale.md,
    fontWeight: fontWeights.medium,
    color: '#333',
    marginBottom: sp[2],
    marginTop: sp[4],
  },
  vinHint: {
    fontSize: typeScale.xs,
    fontWeight: fontWeights.regular,
    color: '#007AFF',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: radii.sm,
    padding: sp[3],
    fontSize: typeScale.md,
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
