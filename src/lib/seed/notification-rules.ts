/**
 * Default notification rule seed (Sprint 17).
 *
 * Seeds three rules per org. Orgs can disable/customize via the admin UI.
 * Idempotent — uses ON CONFLICT DO NOTHING on the (org, code) unique index.
 */

import { getRawClient } from '@/db/client';
import { notificationRules } from '@/db/schemas/notifications/notification-rules';

export interface DefaultRuleSeed {
  code: string;
  category: 'parts_delay' | 'supplement_pending' | 'delivery_at_risk';
  severity: 'info' | 'warning' | 'critical';
  label: string;
  description: string;
  channels: ('in_app' | 'sms' | 'email')[];
  params: Record<string, unknown>;
}

export const DEFAULT_RULES: readonly DefaultRuleSeed[] = [
  {
    code: 'parts_delay',
    category: 'parts_delay',
    severity: 'warning',
    label: 'Forsinkede deler',
    description:
      'Varsler når en del har vært flagget i mer enn 3 dager uten å bli bestilt.',
    channels: ['in_app'],
    params: { thresholdDays: 3 },
  },
  {
    code: 'supplement_pending',
    category: 'supplement_pending',
    severity: 'warning',
    label: 'Tillegg venter på godkjenning',
    description:
      'Varsler når et tilleggsestimat har ventet mer enn 2 dager på godkjenning.',
    channels: ['in_app'],
    params: { thresholdDays: 2 },
  },
  {
    code: 'delivery_at_risk',
    category: 'delivery_at_risk',
    severity: 'critical',
    label: 'Leveringsdato i fare',
    description:
      'Varsler når prognose for levering er etter lovet dato (≥ 24 t avvik).',
    channels: ['in_app'],
    params: { minSlipHours: 24 },
  },
];

export async function seedNotificationRules(
  organizationId: string,
): Promise<number> {
  const db = getRawClient({ as: 'admin' });
  let inserted = 0;
  for (const rule of DEFAULT_RULES) {
    const result = await db
      .insert(notificationRules)
      .values({
        organizationId,
        code: rule.code,
        category: rule.category,
        severity: rule.severity,
        label: rule.label,
        description: rule.description,
        channels: rule.channels,
        params: rule.params,
        enabled: true,
      })
      .onConflictDoNothing()
      .returning({ id: notificationRules.id });
    inserted += result.length;
  }
  return inserted;
}
