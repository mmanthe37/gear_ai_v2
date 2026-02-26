import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';

interface ModernServiceCardProps {
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  vehicle: string;
  onPress?: () => void;
}

const priorityColors = {
  low: '#00FF00',
  medium: '#FF8C00',
  high: '#FF4500',
};

const priorityIcons: Record<'low' | 'medium' | 'high', keyof typeof Ionicons.glyphMap> = {
  low: 'checkmark-circle',
  medium: 'warning',
  high: 'alert-circle',
};

export default function ModernServiceCard({
  title,
  description,
  dueDate,
  priority,
  vehicle,
  onPress,
}: ModernServiceCardProps) {
  const { theme, colors } = useTheme();
  const blurTint = theme === 'light' ? 'light' : 'dark';
  const priorityColor = priorityColors[priority];
  const priorityIcon = priorityIcons[priority];

  const styles = StyleSheet.create({
    container: {
      marginBottom: 12,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: colors.actionAccent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: theme === 'light' ? 0.12 : 0.25,
      shadowRadius: 16,
      elevation: 8,
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
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    iconContainer: {
      marginRight: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    iconGradient: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mainContent: {
      flex: 1,
    },
    title: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    description: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
      fontWeight: '500',
    },
    vehicle: {
      fontSize: 12,
      color: colors.actionAccent,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dateContainer: {
      alignItems: 'flex-end',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 8,
      padding: 8,
    },
    dueDate: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    dueLabel: {
      fontSize: 10,
      color: colors.warning,
      marginTop: 2,
      fontWeight: '700',
      letterSpacing: 1,
    },
    progressBar: {
      height: 3,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressGradient: {
      flex: 1,
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <BlurView intensity={25} tint={blurTint} style={styles.blur}>
        <LinearGradient
          colors={[colors.cardGlow, `${colors.cardGlow}80`, `${colors.cardGlow}30`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={[priorityColor, `${priorityColor}CC`]}
                  style={styles.iconGradient}
                >
                  <Ionicons name={priorityIcon} size={24} color="white" />
                </LinearGradient>
              </View>

              <View style={styles.mainContent}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.description}>{description}</Text>
                <Text style={styles.vehicle}>{vehicle}</Text>
              </View>

              <View style={styles.dateContainer}>
                <Text style={styles.dueDate}>{dueDate}</Text>
                <Text style={styles.dueLabel}>DUE</Text>
              </View>
            </View>

            <View style={styles.progressBar}>
              <LinearGradient
                colors={[priorityColor, `${priorityColor}80`, `${priorityColor}40`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.progressGradient}
              />
            </View>
          </View>
        </LinearGradient>
      </BlurView>
    </TouchableOpacity>
  );
}