import type { Metadata } from 'next';
import { type ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/next';

import './globals.css';

export const metadata: Metadata = {
  title: 'VerkstedOS',
  description:
    'Cloud ERP and production-management platform for collision-repair workshops.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="nb" suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
