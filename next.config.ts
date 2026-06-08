import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

// In GitHub Codespaces the dev server is reached through a forwarded
// host like `<codespace>-3000.app.github.dev`. We need to whitelist it
// for:
//   - Server Actions (rejected by Next 14+ if the origin doesn't match)
//   - HMR / dev resources (`/_next/webpack-hmr` cross-origin warning)
const codespaceName = process.env['CODESPACE_NAME'];
const forwardingDomain =
  process.env['GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN'] ?? 'app.github.dev';
const codespaceOrigin = codespaceName
  ? `${codespaceName}-3000.${forwardingDomain}`
  : null;

const extraAllowedOrigins = [codespaceOrigin, '127.0.0.1', 'localhost'].filter(
  (v): v is string => Boolean(v),
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: extraAllowedOrigins,
  experimental: {
    serverActions: {
      allowedOrigins: extraAllowedOrigins,
    },
  },
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
