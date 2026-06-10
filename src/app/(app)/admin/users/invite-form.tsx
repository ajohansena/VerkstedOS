'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { inviteEmployeeAction } from './actions';

interface RoleOption {
  readonly id: string;
  readonly name: string;
}

interface WorkshopOption {
  readonly id: string;
  readonly name: string;
}

interface Props {
  readonly roles: readonly RoleOption[];
  readonly workshops: readonly WorkshopOption[];
}

const INITIAL = { ok: false, message: '' } as const;

/**
 * Invite-employee form for the customer Admin surface (Sprint 20).
 * Server action enforces `admin:users`. PlatformOwner is not involved.
 */
export default function InviteEmployeeForm({ roles, workshops }: Props) {
  const [state, formAction, pending] = useActionState(
    inviteEmployeeAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="invite-email">
            Email *
          </label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="employee@example.com"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="invite-name">
            Full name *
          </label>
          <Input
            id="invite-name"
            name="fullName"
            type="text"
            required
            placeholder="e.g. Kari Nordmann"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="invite-role">
            Role *
          </label>
          <select
            id="invite-role"
            name="roleId"
            required
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">— select role —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="invite-workshop">
            Default workshop
          </label>
          <select
            id="invite-workshop"
            name="workshopId"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">— all workshops —</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p
          className={
            state.message
              ? state.ok
                ? 'text-sm text-green-700'
                : 'text-sm text-destructive'
              : 'text-xs text-muted-foreground'
          }
        >
          {state.message ||
            'A magic-link invite email will be sent to the address above.'}
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? 'Inviting…' : 'Send invite'}
        </Button>
      </div>
    </form>
  );
}
