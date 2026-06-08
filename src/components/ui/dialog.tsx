'use client';

import { X } from 'lucide-react';
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { cn } from '@/lib/utils';

/**
 * Minimal accessible dialog primitive (no headless-ui dependency).
 *
 * Used for the command palette, drawers, and inline modals. Closes on Escape
 * and on backdrop click; locks body scroll while open; restores focus on
 * close. Caller owns the open state.
 */
export function Dialog({
  open,
  onClose,
  children,
  className,
  side = 'center',
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Where the panel anchors. `right` becomes a side drawer. */
  side?: 'center' | 'right';
  ariaLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  const handleBackdrop = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
      className={cn(
        'fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm',
        side === 'center'
          ? 'items-start justify-center pt-[10vh]'
          : 'items-stretch justify-end',
      )}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative bg-background shadow-xl outline-none',
          side === 'center'
            ? 'w-full max-w-2xl rounded-lg border'
            : 'h-full w-full max-w-xl border-l',
          className,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
