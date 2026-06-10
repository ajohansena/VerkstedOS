'use client';

import { Bell, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { OrgSwitcher } from '@/components/org-switcher';
import { Dialog } from '@/components/ui/dialog';

import { CommandPalette } from './command-palette';

interface TopbarProps {
  labels: {
    commandPaletteHint: string;
    commandShortcut: string;
    signedInAs: string;
    workshop: string;
    notifications: string;
    paletteLabels: {
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
    };
  };
  user: { email: string };
  organizations: { id: string; name: string }[];
  currentOrgId: string;
  currentWorkshop: string | null;
  unreadNotificationCount: number;
  recents: { id: string; caseNumber: string; subtitle: string | null }[];
}

/**
 * Persistent top bar (doc 12 §3). Breadcrumb-like context on the left;
 * command-palette trigger + org switcher + user on the right. The breadcrumb
 * is delegated to the page (server) header inside content so the topbar stays
 * truly cross-cutting.
 */
export function AppTopbar({
  labels,
  user,
  organizations,
  currentOrgId,
  currentWorkshop,
  unreadNotificationCount,
  recents,
}: TopbarProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isPaletteShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isPaletteShortcut) {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if (event.key === '/' && !isInsideEditable(event.target)) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur md:px-4">
        <div className="hidden flex-1 items-center text-sm text-muted-foreground md:flex">
          {currentWorkshop ? (
            <span className="truncate">
              <span className="font-medium text-foreground">
                {currentWorkshop}
              </span>
            </span>
          ) : (
            <span className="font-medium text-foreground">VerkstedOS</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="inline-flex h-9 max-w-md flex-1 items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 md:w-80 md:flex-none"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{labels.commandPaletteHint}</span>
          </span>
          <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline">
            {labels.commandShortcut}
          </kbd>
        </button>

        <div className="flex items-center gap-3">
          <Link
            href="/notifications"
            aria-label={labels.notifications}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            title={labels.notifications}
          >
            <Bell className="h-4 w-4" aria-hidden />
            {unreadNotificationCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </span>
            )}
          </Link>
          <OrgSwitcher
            organizations={organizations}
            currentOrgId={currentOrgId}
          />
          <div
            className="hidden text-right text-xs leading-tight md:block"
            title={`${labels.signedInAs} ${user.email}`}
          >
            <div className="font-medium text-foreground">
              {user.email.split('@')[0]}
            </div>
            <div className="text-muted-foreground">
              {user.email.split('@')[1] ?? ''}
            </div>
          </div>
        </div>
      </header>

      <Dialog
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        ariaLabel={labels.commandPaletteHint}
        className="overflow-hidden"
      >
        <CommandPalette
          labels={labels.paletteLabels}
          recents={recents}
          onClose={() => setPaletteOpen(false)}
        />
      </Dialog>
    </>
  );
}

function isInsideEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}
