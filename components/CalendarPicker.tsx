import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../theme/tokens';
import { fontFamilies, typeScale } from '../theme/typography';

interface CalendarPickerProps {
  visible: boolean;
  /** Currently selected ISO date string (YYYY-MM-DD) */
  value: string;
  onChange: (iso: string) => void;
  onClose: () => void;
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarPicker({ visible, value, onChange, onClose }: CalendarPickerProps) {
  const today = new Date();
  const seed = value ? new Date(value + 'T12:00:00') : today;

  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());

  const selected = value ? new Date(value + 'T12:00:00') : null;

  // Build grid: leading nulls + days of month + trailing nulls to fill last row
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const selectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${viewYear}-${mm}-${dd}`);
    onClose();
  };

  const isSelected = (day: number) =>
    !!selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day;

  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day;

  const weeks = Math.ceil(cells.length / 7);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Month navigation */}
          <View style={styles.header}>
            <Pressable onPress={prevMonth} style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}>
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <Text style={styles.monthYear}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <Pressable onPress={nextMonth} style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}>
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>

          {/* Day-of-week labels */}
          <View style={styles.row}>
            {DAY_HEADERS.map((d) => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          {Array.from({ length: weeks }, (_, week) => (
            <View key={week} style={styles.row}>
              {cells.slice(week * 7, week * 7 + 7).map((day, col) => (
                <Pressable
                  key={col}
                  onPress={() => day && selectDay(day)}
                  disabled={!day}
                  style={({ pressed }) => [
                    styles.dayCell,
                    !!day && isSelected(day) ? styles.dayCellSelected : undefined,
                    !!day && isToday(day) && !isSelected(day) ? styles.dayCellToday : undefined,
                    pressed && !!day ? styles.pressed : undefined,
                  ]}
                >
                  <Text style={[
                    styles.dayText,
                    !!day && isSelected(day) ? styles.dayTextSelected : undefined,
                    !!day && isToday(day) && !isSelected(day) ? styles.dayTextToday : undefined,
                  ]}>
                    {day ?? ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}

          <Pressable onPress={onClose} style={({ pressed }) => [styles.cancelRow, pressed && styles.pressed]}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    width: 308,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { color: colors.textPrimary, fontSize: 22, lineHeight: 26 },
  monthYear: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  dayHeader: {
    width: 40,
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: 11,
    textTransform: 'uppercase',
    paddingVertical: 4,
  },
  dayCell: {
    width: 40,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: { backgroundColor: colors.brandAccent },
  dayCellToday: { borderWidth: 1, borderColor: colors.brandAccent },
  dayText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  dayTextSelected: { color: colors.background, fontFamily: fontFamilies.heading },
  dayTextToday: { color: colors.brandAccent },
  cancelRow: { marginTop: 8, alignSelf: 'center', padding: 8 },
  cancelText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  pressed: { opacity: 0.7 },
});
