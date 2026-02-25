import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ShellRouteKey, SidebarChatItem, SidebarVehicleItem } from '../../types/shell';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';
import GearLogo from '../branding/GearLogo';
import { PRIMARY_NAV_ITEMS, getTopNavActiveKey } from './nav-config';

interface AppSidebarProps {
  routeKey: ShellRouteKey;
  collapsed: boolean;
  vehicles: SidebarVehicleItem[];
  chats: SidebarChatItem[];
  onToggleCollapse?: () => void;
  onCloseMobile?: () => void;
}

function formatMileage(value?: number): string {
  if (!value && value !== 0) return 'Mileage unknown';
  return `${value.toLocaleString()} mi`;
}

export default function AppSidebar({
  routeKey,
  collapsed,
  vehicles,
  chats,
  onToggleCollapse,
  onCloseMobile,
}: AppSidebarProps) {
  const activeKey = getTopNavActiveKey(routeKey);
  const isMobileDrawer = Boolean(onCloseMobile && !onToggleCollapse);

  const navigate = (href: string) => {
    router.push(href as never);
    onCloseMobile?.();
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandBlock}>
        <GearLogo variant="icon" size={collapsed ? 'sm' : 'md'} showWordmark={!collapsed} />
        {!collapsed && <Text style={styles.brandSubtext}>Automotive Intelligence</Text>}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          {!collapsed && <Text style={styles.sectionTitle}>Navigation</Text>}
          {PRIMARY_NAV_ITEMS.map((item) => {
            const active = item.key === activeKey;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => navigate(item.href)}
                style={({ pressed }) => [
                  styles.navItem,
                  collapsed && styles.navItemCollapsed,
                  active && styles.navItemActive,
                  pressed && styles.navItemInteraction,
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={active ? colors.textPrimary : colors.textSecondary}
                />
                {!collapsed && <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.section}>
          {!collapsed && <Text style={styles.sectionTitle}>Garage</Text>}
          {vehicles.length === 0 ? (
            !collapsed && <Text style={styles.emptyText}>No vehicles added yet.</Text>
          ) : (
            vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.id}
                accessibilityRole="button"
                onPress={() => navigate(`/garage/${vehicle.id}`)}
                style={({ pressed }) => [
                  styles.listItem,
                  collapsed && styles.listItemCollapsed,
                  pressed && styles.navItemInteraction,
                ]}
              >
                <Ionicons name="car-outline" size={18} color={colors.brandAccent} />
                {!collapsed && (
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {vehicle.label}
                    </Text>
                    <Text style={styles.listMeta} numberOfLines={1}>
                      {formatMileage(vehicle.mileage)}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.section}>
          {!collapsed && <Text style={styles.sectionTitle}>Recent Chats</Text>}
          {chats.length === 0 ? (
            !collapsed && <Text style={styles.emptyText}>No conversations yet.</Text>
          ) : (
            chats.map((chat) => (
              <Pressable
                key={chat.id}
                accessibilityRole="button"
                onPress={() => {
                  router.push({
                    pathname: '/chat/[id]',
                    params: { id: chat.vehicleId || chat.id },
                  });
                  onCloseMobile?.();
                }}
                style={({ pressed }) => [
                  styles.listItem,
                  collapsed && styles.listItemCollapsed,
                  pressed && styles.navItemInteraction,
                ]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.actionAccent} />
                {!collapsed && (
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {chat.title}
                    </Text>
                    <Text style={styles.listMeta} numberOfLines={1}>
                      {chat.subtitle || 'Vehicle assistant'}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.collapseButton,
            collapsed && styles.navItemCollapsed,
            pressed && styles.navItemInteraction,
          ]}
          onPress={() => {
            if (isMobileDrawer) {
              onCloseMobile?.();
              return;
            }
            onToggleCollapse?.();
          }}
        >
          <Ionicons
            name={
              isMobileDrawer
                ? 'close-outline'
                : collapsed
                  ? 'chevron-forward-outline'
                  : 'chevron-back-outline'
            }
            size={18}
            color={colors.textSecondary}
          />
          {!collapsed && (
            <Text style={styles.collapseLabel}>{isMobileDrawer ? 'Close' : 'Collapse'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: 'rgba(18, 26, 35, 0.94)',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  brandBlock: {
    minHeight: 94,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  brandSubtext: {
    color: colors.textSecondary,
    fontSize: typeScale.xs,
    fontFamily: fontFamilies.body,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 14,
    gap: 18,
  },
  section: {
    gap: 8,
    paddingHorizontal: 10,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.xs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  navItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  navItemActive: {
    borderColor: colors.brandAccent,
    backgroundColor: 'rgba(51, 214, 210, 0.14)',
  },
  navItemInteraction: {
    opacity: 0.92,
  },
  navLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  navLabelActive: {
    color: colors.textPrimary,
  },
  listItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  listItemCollapsed: {
    justifyContent: 'center',
    paddingVertical: 12,
  },
  listCopy: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  listMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typeScale.xs,
    fontFamily: fontFamilies.body,
    lineHeight: 16,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 10,
  },
  collapseButton: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  collapseLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
});
