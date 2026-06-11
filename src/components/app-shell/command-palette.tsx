'use client';

import {
  ArrowRight,
  Boxes,
  ClipboardList,
  Clock,
  KanbanSquare,
  Plus,
  Search,
  Settings,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { searchPaletteAction } from '@/app/actions/palette-search';
import { cn } from '@/lib/utils';

interface PaletteLabels {
  placeholder: string;
  sectionRecents: string;
  sectionGoto: string;
  sectionActions: string;
  sectionCases: string;
  sectionVehicles: string;
  sectionCustomers: string;
  empty: string;
  actionNewCase: string;
  actionClockIn: string;
  actionInbound: string;
  gotoOps: string;
  gotoProduction: string;
  gotoCases: string;
  gotoParts: string;
  gotoAdmin: string;
}

interface Recent {
  id: string;
  caseNumber: string;
  subtitle: string | null;
}

interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: LucideIcon;
  href: string;
  group: string;
}

/**
 * Command palette content. Renders inside the topbar's `Dialog`. Handles input,
 * arrow-key navigation, Enter to activate, and live search via a server action.
 * Recents are pre-fetched and shown when the input is empty.
 */
export function CommandPalette({
  labels,
  recents,
  onClose,
}: {
  labels: PaletteLabels;
  recents: Recent[];
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    cases: CommandItem[];
    vehicles: CommandItem[];
    customers: CommandItem[];
  }>({ cases: [], vehicles: [], customers: [] });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults({ cases: [], vehicles: [], customers: [] });
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const out = await searchPaletteAction(trimmed);
        setResults({
          cases: out.cases.map((c) => ({
            id: `case:${c.id}`,
            label: c.caseNumber,
            ...(c.subtitle != null ? { subtitle: c.subtitle } : {}),
            icon: ClipboardList,
            href: `/cases/${c.id}`,
            group: labels.sectionCases,
          })),
          vehicles: out.vehicles.map((v) => ({
            id: `vehicle:${v.id}`,
            label: v.label,
            ...(v.subtitle != null ? { subtitle: v.subtitle } : {}),
            icon: Boxes,
            href: `/vehicles?q=${encodeURIComponent(v.subtitle ?? v.label)}`,
            group: labels.sectionVehicles,
          })),
          customers: out.customers.map((c) => ({
            id: `customer:${c.id}`,
            label: c.label,
            ...(c.subtitle != null ? { subtitle: c.subtitle } : {}),
            icon: Boxes,
            href: `/customers?q=${encodeURIComponent(c.label)}`,
            group: labels.sectionCustomers,
          })),
        });
        setActiveIndex(0);
      } catch {
        /* swallow — palette stays empty */
      }
    }, 180);
    return () => window.clearTimeout(handle);
  }, [
    query,
    labels.sectionCases,
    labels.sectionVehicles,
    labels.sectionCustomers,
  ]);

  const items = useMemo<CommandItem[]>(() => {
    if (query.trim().length >= 2) {
      return [...results.cases, ...results.vehicles, ...results.customers];
    }
    const recentItems: CommandItem[] = recents.map((r) => ({
      id: `recent:${r.id}`,
      label: r.caseNumber,
      ...(r.subtitle != null ? { subtitle: r.subtitle } : {}),
      icon: ClipboardList,
      href: `/cases/${r.id}`,
      group: labels.sectionRecents,
    }));
    const gotoItems: CommandItem[] = [
      {
        id: 'goto:ops',
        label: labels.gotoOps,
        icon: KanbanSquare,
        href: '/',
        group: labels.sectionGoto,
      },
      {
        id: 'goto:prod',
        label: labels.gotoProduction,
        icon: KanbanSquare,
        href: '/production',
        group: labels.sectionGoto,
      },
      {
        id: 'goto:cases',
        label: labels.gotoCases,
        icon: ClipboardList,
        href: '/cases',
        group: labels.sectionGoto,
      },
      {
        id: 'goto:parts',
        label: labels.gotoParts,
        icon: Boxes,
        href: '/parts',
        group: labels.sectionGoto,
      },
      {
        id: 'goto:admin',
        label: labels.gotoAdmin,
        icon: Settings,
        href: '/admin',
        group: labels.sectionGoto,
      },
    ];
    const actionItems: CommandItem[] = [
      {
        id: 'action:new-case',
        label: labels.actionNewCase,
        icon: Plus,
        href: '/cases/new',
        group: labels.sectionActions,
      },
      {
        id: 'action:clock',
        label: labels.actionClockIn,
        icon: Clock,
        href: '/clock',
        group: labels.sectionActions,
      },
      {
        id: 'action:yard',
        label: labels.actionInbound,
        icon: Truck,
        href: '/yard',
        group: labels.sectionActions,
      },
    ];
    return [...recentItems, ...gotoItems, ...actionItems];
  }, [query, recents, results, labels]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [items]);

  const activate = (item: CommandItem) => {
    onClose();
    router.push(item.href);
  };

  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((idx) => Math.min(idx + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = items[activeIndex];
      if (target) activate(target);
    }
  };

  let runningIndex = -1;

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder={labels.placeholder}
          className="h-8 w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {labels.empty}
          </p>
        ) : (
          grouped.map(([group, groupItems]) => (
            <div key={group} className="mb-2">
              <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group}
              </div>
              <ul>
                {groupItems.map((item) => {
                  runningIndex += 1;
                  const Icon = item.icon;
                  const isActive = runningIndex === activeIndex;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => activate(item)}
                        onMouseMove={() => setActiveIndex(items.indexOf(item))}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                          isActive
                            ? 'bg-muted text-foreground'
                            : 'text-foreground hover:bg-muted/60',
                        )}
                      >
                        <Icon
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {item.label}
                          </span>
                          {item.subtitle ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          ) : null}
                        </span>
                        <ArrowRight
                          className={cn(
                            'h-4 w-4 shrink-0 text-muted-foreground transition-opacity',
                            isActive ? 'opacity-100' : 'opacity-0',
                          )}
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
