import type { ReactNode } from 'react';
import type { ShellRouteKey } from '../../types/shell';

export interface AppShellProps {
  routeKey: ShellRouteKey;
  title: string;
  subtitle?: string;
  children: ReactNode;
}
