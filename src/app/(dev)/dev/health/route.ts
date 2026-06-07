import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Dev Control Plane health endpoint.
 *
 * Sprint 1: open, returns 200 with a status object (demoable outcome).
 * Sprint 4 places the whole /dev surface behind hardened middleware
 * (IP allow-list + platform auth). See docs/06-developer-control-plane.md.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'verkstedos',
    surface: 'dev-control-plane',
    timestamp: new Date().toISOString(),
    checks: {
      app: 'ok',
      supabase: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? 'configured'
        : 'not_configured',
      inngest: process.env.INNGEST_EVENT_KEY ? 'configured' : 'not_configured',
      sentry: process.env.NEXT_PUBLIC_SENTRY_DSN
        ? 'configured'
        : 'not_configured',
    },
  });
}
