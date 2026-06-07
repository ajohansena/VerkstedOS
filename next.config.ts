import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

// Sentry's build-time plugin (source-map upload, instrumentation) is only
// applied when a DSN is configured. Without it, builds use the plain config —
// keeping Sprint 1 / CI builds clean before the owner provisions Sentry.
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const org = process.env.SENTRY_ORG;
const project = process.env.SENTRY_PROJECT;

const config: NextConfig = sentryDsn
  ? withSentryConfig(nextConfig, {
      silent: true,
      ...(org ? { org } : {}),
      ...(project ? { project } : {}),
    })
  : nextConfig;

export default config;
