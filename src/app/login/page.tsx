import { Suspense } from 'react';

import LoginPageClient from './login-client';

/**
 * /login — server wrapper. The interactive form (`LoginPageClient`) reads
 * `useSearchParams()` for the `?error=` flash, which Next requires to sit
 * inside a Suspense boundary for static prerendering.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageClient />
    </Suspense>
  );
}
