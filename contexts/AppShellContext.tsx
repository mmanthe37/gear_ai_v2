import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { breakpoints } from '../theme/tokens';

const SIDEBAR_KEY = 'gearai:shell:sidebar-collapsed';

interface AppShellContextType {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  isDesktop: boolean;
  isTablet: boolean;
  isMobile: boolean;
  setSidebarCollapsed: (next: boolean) => void;
  toggleSidebarCollapsed: () => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
}

const AppShellContext = createContext<AppShellContextType | undefined>(undefined);

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const isDesktop = width >= breakpoints.desktop;
  const isMobile = width < breakpoints.mobile;
  const isTablet = width >= breakpoints.mobile && width < breakpoints.desktop;

  useEffect(() => {
    let mounted = true;

    async function hydrateSidebarState() {
      try {
        const stored = await AsyncStorage.getItem(SIDEBAR_KEY);
        if (!mounted) return;
        setIsSidebarCollapsed(stored === '1');
      } finally {
        if (mounted) {
          setIsHydrated(true);
        }
      }
    }

    hydrateSidebarState();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(SIDEBAR_KEY, isSidebarCollapsed ? '1' : '0').catch(() => {
      // Persisting shell preferences should never block UI interaction.
    });
  }, [isHydrated, isSidebarCollapsed]);

  useEffect(() => {
    if (isDesktop) {
      setIsMobileSidebarOpen(false);
    }
  }, [isDesktop]);

  const value = useMemo<AppShellContextType>(
    () => ({
      isSidebarCollapsed,
      isMobileSidebarOpen,
      isDesktop,
      isTablet,
      isMobile,
      setSidebarCollapsed: setIsSidebarCollapsed,
      toggleSidebarCollapsed: () => setIsSidebarCollapsed((prev) => !prev),
      openMobileSidebar: () => setIsMobileSidebarOpen(true),
      closeMobileSidebar: () => setIsMobileSidebarOpen(false),
      toggleMobileSidebar: () => setIsMobileSidebarOpen((prev) => !prev),
    }),
    [isDesktop, isMobile, isSidebarCollapsed, isMobileSidebarOpen, isTablet]
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShell must be used within AppShellProvider');
  }
  return context;
}
