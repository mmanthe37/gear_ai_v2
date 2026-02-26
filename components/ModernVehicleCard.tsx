import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';

interface ModernVehicleCardProps {
  make: string;
  model: string;
  year: number;
  vin?: string;
  mileage?: number;
  onPress: () => void;
}

export default function ModernVehicleCard({
  make,
  model,
  year,
  vin,
  mileage,
  onPress,
}: ModernVehicleCardProps) {
  const { theme, colors } = useTheme();
  const blurTint = theme === 'light' ? 'light' : 'dark';

  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: colors.brandAccent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme === 'light' ? 0.15 : 0.3,
      shadowRadius: 24,
      elevation: 12,
    },
    blur: {
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    gradient: {
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    content: {
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    carIconContainer: {
      marginRight: 16,
    },
    carIconGradient: {
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.brandAccent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
    },
    vehicleInfo: {
      flex: 1,
    },
    vehicleName: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    vehicleYear: {
      fontSize: 14,
      color: colors.actionAccent,
      fontWeight: '600',
    },
    statusIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
      marginRight: 8,
      shadowColor: colors.success,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
    },
    details: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    detailText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 6,
      fontWeight: '600',
    },
    performanceBar: {
      height: 3,
      borderRadius: 2,
      overflow: 'hidden',
    },
    performanceGradient: {
      flex: 1,
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <BlurView intensity={25} tint={blurTint} style={styles.blur}>
        <LinearGradient
          colors={[colors.cardGlow, `${colors.cardGlow}80`, `${colors.cardGlow}40`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.carIconContainer}>
                <LinearGradient
                  colors={['#FF4500', '#FF8C00']}
                  style={styles.carIconGradient}
                >
                  <Ionicons name="car-sport" size={28} color="white" />
                </LinearGradient>
              </View>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleName}>{make} {model}</Text>
                <Text style={styles.vehicleYear}>{year}</Text>
              </View>
              <View style={styles.statusIndicator}>
                <View style={styles.statusDot} />
                <Ionicons name="chevron-forward" size={20} color={colors.brandAccent} />
              </View>
            </View>
            
            {(vin || mileage) && (
              <View style={styles.details}>
                {vin && (
                  <View style={styles.detailItem}>
                    <Ionicons name="barcode-outline" size={16} color={colors.actionAccent} />
                    <Text style={styles.detailText}>VIN: {vin.slice(-6)}</Text>
                  </View>
                )}
                {mileage && (
                  <View style={styles.detailItem}>
                    <Ionicons name="speedometer-outline" size={16} color={colors.brandAccent} />
                    <Text style={styles.detailText}>{mileage.toLocaleString()} mi</Text>
                  </View>
                )}
              </View>
            )}
            
            <View style={styles.performanceBar}>
              <LinearGradient
                colors={['#FF4500', '#FF8C00', colors.actionAccent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.performanceGradient}
              />
            </View>
          </View>
        </LinearGradient>
      </BlurView>
    </TouchableOpacity>
  );
}