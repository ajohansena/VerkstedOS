/**
 * Platform permission catalog — platform permissions are CODE, completely
 * separate from customer permissions (docs/06-developer-control-plane.md,
 * CLAUDE.md § 4.3). No customer-org role can ever grant these.
 */

export interface PlatformPermissionDefinition {
  readonly code: string;
  readonly description: string;
}

export const PLATFORM_PERMISSION_CATALOG = [
  { code: 'platform:org:view', description: 'View any organization.' },
  { code: 'platform:org:lock', description: 'Lock/unlock an organization.' },
  { code: 'platform:org:configure', description: 'Configure an organization.' },
  { code: 'platform:user:view', description: 'View any user.' },
  {
    code: 'platform:user:impersonate',
    description: 'Impersonate a user (audited).',
  },
  { code: 'platform:user:disable', description: 'Disable a user.' },
  { code: 'platform:audit:view', description: 'View the platform audit log.' },
  { code: 'platform:event:view', description: 'View events and the outbox.' },
  { code: 'platform:event:replay', description: 'Replay events.' },
  { code: 'platform:job:view', description: 'View background jobs.' },
  { code: 'platform:job:retry', description: 'Retry a failed job.' },
  { code: 'platform:job:pause', description: 'Pause job processing.' },
  {
    code: 'platform:integration:view',
    description: 'View integration activity.',
  },
  {
    code: 'platform:integration:replay',
    description: 'Replay integration payloads.',
  },
  {
    code: 'platform:integration:disable',
    description: 'Disable an integration.',
  },
  { code: 'platform:data:repair', description: 'Run data-repair tools.' },
  { code: 'platform:flag:manage', description: 'Manage feature flags.' },
  {
    code: 'platform:emergency:execute',
    description: 'Execute emergency actions (PlatformOwner co-sign).',
  },
] as const satisfies readonly PlatformPermissionDefinition[];

export type PlatformPermissionCode =
  (typeof PLATFORM_PERMISSION_CATALOG)[number]['code'];

export type PlatformRoleKey =
  | 'PlatformOwner'
  | 'PlatformDeveloper'
  | 'PlatformSupport';

const ALL: readonly PlatformPermissionCode[] = PLATFORM_PERMISSION_CATALOG.map(
  (p) => p.code,
);

/** Standard platform-role permission bundles (docs/06). */
export const PLATFORM_ROLE_PERMISSIONS: Record<
  PlatformRoleKey,
  readonly PlatformPermissionCode[]
> = {
  // PlatformOwner: everything.
  PlatformOwner: ALL,
  // PlatformDeveloper: everything except emergency execution (needs owner co-sign).
  PlatformDeveloper: ALL.filter(
    (code) => code !== 'platform:emergency:execute',
  ),
  // PlatformSupport: view-only across the board + impersonation.
  PlatformSupport: [
    'platform:org:view',
    'platform:user:view',
    'platform:user:impersonate',
    'platform:audit:view',
    'platform:event:view',
    'platform:job:view',
    'platform:integration:view',
  ],
};

const PLATFORM_CODE_SET: ReadonlySet<string> = new Set(ALL);

export function isPlatformPermissionCode(
  value: string,
): value is PlatformPermissionCode {
  return PLATFORM_CODE_SET.has(value);
}
