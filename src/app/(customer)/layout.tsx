import { type ReactNode } from 'react';

/**
 * Customer portal layout (Sprint 17). Unauth'd routes for end customers and
 * insurers (read-only). Deliberately bare — no sidebar, no command palette,
 * no org switcher. The case status is the entire surface.
 */
export default function CustomerLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="font-semibold tracking-tight">VerkstedOS</div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
