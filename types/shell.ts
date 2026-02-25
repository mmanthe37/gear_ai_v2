import type { Ionicons } from '@expo/vector-icons';

export type ShellRouteKey =
  | 'garage'
  | 'vehicle-detail'
  | 'garage-new'
  | 'maintenance'
  | 'maintenance-new'
  | 'diagnostics'
  | 'manuals'
  | 'chat'
  | 'settings';

export interface ShellNavItem {
  key: 'garage' | 'maintenance' | 'diagnostics' | 'manuals' | 'settings';
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface SidebarVehicleItem {
  id: string;
  label: string;
  subtitle?: string;
  mileage?: number;
}

export interface SidebarChatItem {
  id: string;
  vehicleId?: string;
  title: string;
  subtitle?: string;
  updatedAt?: string;
}
