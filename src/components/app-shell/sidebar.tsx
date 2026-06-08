'use client';

import {
  Activity,
  Boxes,
  ClipboardList,
  Clock,
  KanbanSquare,
  type LucideIcon,
  Package,
  Settings,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  labelKey:
    | 'operations'
    | 'production'
    | 'cases'
    | 'parts'
    | 'vehicles'
    | 'customers'
    | 'yard'
    | 'insights'
    | 'admin'
    | 'clock';
  icon: LucideIcon;
}

const PRIMARY: NavItem[] = [
  { href: '/', labelKey: 'operations', icon: Activity },
  { href: '/production', labelKey: 'production', icon: KanbanSquare },
  { href: '/cases', labelKey: 'cases', icon: ClipboardList },
  { href: '/parts', labelKey: 'parts', icon: Package },
  { href: '/yard', labelKey: 'yard', icon: Truck },
  { href: '/clock', labelKey: 'clock', icon: Clock },
];

const SECONDARY: NavItem[] = [
  { href: '/customers', labelKey: 'customers', icon: Users },
  { href: '/vehicles', labelKey: 'vehicles', icon: Boxes },
];

const SETTINGS: NavItem[] = [
  // Insights is a deliberate destination (doc 12 §12); placeholder route OK for
  // now — the link is rendered only after a real Insights page exists, see
  // /admin. Sprint 14 ships the operational-only sidebar; Insights lands later.
  { href: '/admin', labelKey: 'admin', icon: Settings },
];

interface SidebarProps {
  labels: {
    operations: string;
    production: string;
    cases: string;
    parts: string;
    vehicles: string;
    customers: string;
    yard: string;
    insights: string;
    admin: string;
    clock: string;
  };
  organization: { name: string };
}

/**
 * Persistent left sidebar (doc 12 §3). Minimal, role-filtered, collapses to
 * icons on narrow viewports. Active route is highlighted; client component so
 * we can read `usePathname()`.
 */
export function AppSidebar({ labels, organization }: SidebarProps) {
  const pathname = usePathname() ?? '/';

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <TrendingUp className="h-5 w-5 text-primary" aria-hidden />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">
            VerkstedOS
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {organization.name}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <SidebarSection items={PRIMARY} labels={labels} pathname={pathname} />
        <Divider />
        <SidebarSection items={SECONDARY} labels={labels} pathname={pathname} />
        <Divider />
        <SidebarSection items={SETTINGS} labels={labels} pathname={pathname} />
      </nav>
    </aside>
  );
}

function Divider() {
  return <div className="my-2 border-t" aria-hidden />;
}

function SidebarSection({
  items,
  labels,
  pathname,
}: {
  items: NavItem[];
  labels: SidebarProps['labels'];
  pathname: string;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-background font-medium text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{labels[item.labelKey]}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
