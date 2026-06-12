import { Suspense } from 'react';

import { getDictionary } from '@/lib/i18n';

import LoginPageClient from './login-client';

/**
 * /login — server wrapper. Resolves the active locale (defaults to nb-NO per
 * docs/02-system-architecture.md "Norwegian primary, English secondary") and
 * passes the dictionary down to the interactive form. There's no signed-in
 * user yet on this surface, so org settings can't be consulted; the system
 * default applies. The `Suspense` boundary exists because the client form
 * reads `useSearchParams()` for the `?error=` flash.
 */
export default function LoginPage() {
  const t = getDictionary();
  return (
    <Suspense fallback={null}>
      <LoginPageClient labels={t.login} />
    </Suspense>
  );
}
