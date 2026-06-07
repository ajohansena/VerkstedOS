/**
 * Ambient typing for known environment variables.
 *
 * Declaring them as named properties (instead of relying on the ProcessEnv
 * index signature) keeps dot-access type-safe under
 * `noPropertyAccessFromIndexSignature`, and documents the full env surface in
 * one place. Mirror of `.env.example`.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    // --- Supabase ---
    NEXT_PUBLIC_SUPABASE_URL: string | undefined;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string | undefined;
    SUPABASE_SERVICE_ROLE_KEY: string | undefined;
    DATABASE_URL: string | undefined;
    DATABASE_URL_ADMIN: string | undefined;
    // --- Inngest ---
    INNGEST_EVENT_KEY: string | undefined;
    INNGEST_SIGNING_KEY: string | undefined;
    // --- Sentry ---
    NEXT_PUBLIC_SENTRY_DSN: string | undefined;
    SENTRY_AUTH_TOKEN: string | undefined;
    SENTRY_ORG: string | undefined;
    SENTRY_PROJECT: string | undefined;
    // --- App ---
    NEXT_PUBLIC_SITE_URL: string | undefined;
    // --- Dev Control Plane ---
    PLATFORM_ALLOWED_IPS: string | undefined;
    // --- Set by Next.js / CI ---
    NEXT_RUNTIME: 'nodejs' | 'edge' | undefined;
    CI: string | undefined;
  }
}
