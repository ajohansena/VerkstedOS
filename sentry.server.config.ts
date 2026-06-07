import * as Sentry from '@sentry/nextjs';

// Inert until a DSN is configured (Sprint 1 ships placeholder env).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1,
  });
}
