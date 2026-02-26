import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, usePathname } from 'expo-router';
import type { AppShellProps } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { useAppShell } from '../../contexts/AppShellContext';
import type { SidebarChatItem, SidebarVehicleItem } from '../../types/shell';
import { getUserChatSessions } from '../../services/chat-service';
import { getUserVehicles } from '../../services/vehicle-service';
import { radii, shell } from '../../theme/tokens';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamilies, typeScale } from '../../theme/typography';
import GearLogo from '../branding/GearLogo';
import GearActionIcon from '../branding/GearActionIcon';
import AppSidebar from './AppSidebar';
import AppTopNav from './AppTopNav';

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AppShell({ routeKey, title, subtitle, children }: AppShellProps) {
  const { colors } = useTheme();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { user, loading } = useAuth();
  const {
    isDesktop,
    isMobile,
    isSidebarCollapsed,
    isMobileSidebarOpen,
    toggleSidebarCollapsed,
    toggleMobileSidebar,
    closeMobileSidebar,
  } = useAppShell();

  const [vehicles, setVehicles] = useState<SidebarVehicleItem[]>([]);
  const [chats, setChats] = useState<SidebarChatItem[]>([]);
  const [isSidebarLoading, setIsSidebarLoading] = useState(false);

  const loadSidebarData = useCallback(async () => {
    if (!user?.user_id) {
      setVehicles([]);
      setChats([]);
      return;
    }

    setIsSidebarLoading(true);
    try {
      const [vehicleRows, chatRows] = await Promise.all([
        getUserVehicles(user.user_id),
        getUserChatSessions(user.user_id),
      ]);

      const mappedVehicles = vehicleRows.map((vehicle) => ({
        id: vehicle.vehicle_id,
        label: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        subtitle: vehicle.vin ? `VIN ***${vehicle.vin.slice(-6)}` : undefined,
        mileage: vehicle.current_mileage,
      }));

      const vehicleLabelById = new Map(mappedVehicles.map((vehicle) => [vehicle.id, vehicle.label]));

      const mappedChats = chatRows
        .filter((chat) => Boolean(chat.vehicle_id))
        .slice(0, 8)
        .map((chat) => ({
          id: chat.session_id,
          vehicleId: chat.vehicle_id,
          title: chat.title || vehicleLabelById.get(chat.vehicle_id!) || 'Vehicle assistant',
          subtitle: formatDate(chat.last_message_at),
          updatedAt: chat.last_message_at,
        }));

      setVehicles(mappedVehicles);
      setChats(mappedChats);
    } catch (error) {
      console.warn('Could not load app shell data:', error);
    } finally {
      setIsSidebarLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => {
    loadSidebarData();
  }, [loadSidebarData, pathname]);

  const shellSidebarWidth = useMemo(
    () => (isSidebarCollapsed ? shell.sidebarCollapsed : shell.sidebarExpanded),
    [isSidebarCollapsed]
  );
  const showHeaderWordmark = isDesktop || width >= 860;

  const styles = StyleSheet.create({
    root: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: colors.background,
    },
    loadingState: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingLogo: {
      marginBottom: 14,
    },
    persistentSidebar: {
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    main: {
      flex: 1,
    },
    header: {
      minHeight: shell.headerHeight,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.headerBg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    iconButton: {
      minWidth: 44,
      minHeight: 44,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitleArea: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    pageTitle: {
      color: colors.textPrimary,
      fontFamily: fontFamilies.heading,
      fontSize: typeScale.lg,
    },
    pageSubtitle: {
      color: colors.textSecondary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.xs,
      marginTop: 2,
    },
    accountButton: {
      minHeight: 44,
      maxWidth: 240,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    accountButtonLabel: {
      color: colors.textPrimary,
      fontFamily: fontFamilies.body,
      fontSize: typeScale.sm,
    },
    body: {
      flex: 1,
      minHeight: 0,
    },
    buttonInteraction: {
      opacity: 0.92,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      zIndex: 30,
    },
    mobileSidebar: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      zIndex: 40,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    mobileLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.loadingOverlay,
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <GearLogo variant="micro" size="lg" style={styles.loadingLogo} />
        <ActivityIndicator color={colors.brandAccent} size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {isDesktop && (
        <View style={[styles.persistentSidebar, { width: shellSidebarWidth }]}>
          <AppSidebar
            routeKey={routeKey}
            collapsed={isSidebarCollapsed}
            vehicles={vehicles}
            chats={chats}
            onToggleCollapse={toggleSidebarCollapsed}
          />
        </View>
      )}

      <View style={styles.main}>
        <View style={styles.header}>
          {!isDesktop && (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.buttonInteraction,
              ]}
              onPress={toggleMobileSidebar}
            >
              <Ionicons name="menu" size={22} color={colors.textPrimary} />
            </Pressable>
          )}

          <View style={styles.headerTitleArea}>
            <GearLogo
              variant={showHeaderWordmark ? 'icon' : 'micro'}
              size={isMobile ? 'sm' : 'md'}
              showWordmark={false}
            />
            {showHeaderWordmark && <GearLogo variant="wordmark" size="sm" />}
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={styles.pageTitle}>
                {title}
              </Text>
              {!!subtitle && (
                <Text numberOfLines={1} style={styles.pageSubtitle}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [
              styles.accountButton,
              pressed && styles.buttonInteraction,
            ]}
          >
            <GearActionIcon size="md" />
            <Text style={styles.accountButtonLabel} numberOfLines={1}>
              {user.display_name || 'Account'}
            </Text>
          </Pressable>
        </View>

        <AppTopNav routeKey={routeKey} />

        <View style={styles.body}>{children}</View>
      </View>

      {!isDesktop && isMobileSidebarOpen && (
        <>
          <Pressable style={styles.overlay} onPress={closeMobileSidebar} />
          <View style={[styles.mobileSidebar, { width: Math.min(340, width * 0.84) }]}>
            <AppSidebar
              routeKey={routeKey}
              collapsed={false}
              vehicles={vehicles}
              chats={chats}
              onCloseMobile={closeMobileSidebar}
            />
            {isSidebarLoading && (
              <View style={styles.mobileLoadingOverlay}>
                <ActivityIndicator color={colors.brandAccent} />
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

