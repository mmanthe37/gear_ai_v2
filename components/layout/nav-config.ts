import type { ShellNavItem, ShellRouteKey } from '../../types/shell';

export const PRIMARY_NAV_ITEMS: ShellNavItem[] = [
  { key: 'garage', label: 'Garage', href: '/garage', icon: 'car-sport-outline' },
  { key: 'maintenance', label: 'Maintenance', href: '/maintenance', icon: 'build-outline' },
  { key: 'diagnostics', label: 'Diagnostics', href: '/diagnostics', icon: 'analytics-outline' },
  { key: 'manuals', label: 'Manuals', href: '/manuals', icon: 'book-outline' },
  { key: 'settings', label: 'Settings', href: '/settings', icon: 'settings-outline' },
];

export function getTopNavActiveKey(routeKey: ShellRouteKey): ShellNavItem['key'] {
  if (routeKey === 'vehicle-detail' || routeKey === 'garage-new' || routeKey === 'chat') {
    return 'garage';
  }
  if (routeKey === 'maintenance-new') {
    return 'maintenance';
  }
  return routeKey as ShellNavItem['key'];
}
