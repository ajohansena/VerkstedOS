'use client';

import { format } from '@/lib/i18n';

interface AttentionLabels {
  attention: string;
  attentionEmpty: string;
  inbound: string;
  onHold: string;
  partsBlocked: string;
  longOpen: string;
  pendingAcceptance: string;
}

interface AttentionItem {
  id: string;
  severity: 'red' | 'yellow';
  messageKey:
    | 'inbound'
    | 'onHold'
    | 'partsBlocked'
    | 'longOpen'
    | 'pendingAcceptance';
  params: Record<string, string | number>;
  href: string;
}

/**
 * Operations Center → Attention Zone (doc 12 §4). Every item is actionable;
 * clicking takes the user to the place they resolve it. Quiet when quiet.
 */
export function AttentionZone({
  items,
  labels,
}: {
  items: AttentionItem[];
  labels: AttentionLabels;
}) {
  return (
    <section className="rounded-lg border bg-background shadow-sm">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {labels.attention}
        </h2>
        <span className="text-xs text-muted-foreground">
          {items.length === 0 ? '—' : items.length}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {labels.attentionEmpty}
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => {
            const dotColor =
              item.severity === 'red' ? 'bg-red-500' : 'bg-amber-500';
            const message = format(labels[item.messageKey], item.params);
            return (
              <li key={item.id}>
                <a
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40"
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`}
                    aria-hidden
                  />
                  <span className="flex-1">{message}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
