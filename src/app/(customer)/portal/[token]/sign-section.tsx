'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { getDictionary } from '@/lib/i18n';

import { signRepairAcceptanceAction } from './actions';

type Dictionary = ReturnType<typeof getDictionary>;

interface Props {
  token: string;
  alreadySigned: boolean;
  signedAtIso: string | null;
  sequenceNo: number | null;
  signerName: string | null;
  t: Dictionary;
}

/**
 * Customer portal signing section (Sprint 20). Renders either the signed
 * state (with the signer name + chain position) or a small form that posts
 * to the unauth Server Action. Optimistic UI: the action returns a
 * `{ ok, reason }` shape so the customer sees inline validation.
 */
export function PortalSignSection(props: Props) {
  const { token, alreadySigned, signedAtIso, sequenceNo, signerName, t } = props;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(alreadySigned);

  if (done) {
    return (
      <section className="mt-6 rounded-lg border bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-medium">{t.portalSignature.signed}</p>
        {signerName && <p className="mt-1">{signerName}</p>}
        {signedAtIso && (
          <p className="mt-1 text-xs text-emerald-800">
            {t.portalSignature.signedAt}:{' '}
            {new Intl.DateTimeFormat('nb-NO', {
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(new Date(signedAtIso))}
          </p>
        )}
        {sequenceNo !== null && (
          <p className="text-xs text-emerald-800">
            {t.portalSignature.chainPosition}: #{sequenceNo + 1}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-lg border bg-background p-4">
      <h2 className="text-base font-semibold">
        {t.portalSignature.sectionTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.portalSignature.description}
      </p>
      <form
        className="mt-3 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const result = await signRepairAcceptanceAction(fd);
            if (result.ok) {
              setDone(true);
            } else {
              const reason = result.reason ?? 'token_invalid';
              if (reason === 'name_required') setError(t.portalSignature.nameRequired);
              else if (reason === 'consent_required') setError(t.portalSignature.consentRequired);
              else if (reason === 'already_signed') {
                setError(t.portalSignature.alreadySigned);
                setDone(true);
              } else setError(t.portal.expired);
            }
          });
        }}
      >
        <input type="hidden" name="token" value={token} />
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t.portalSignature.nameLabel}</span>
          <Input
            name="signerName"
            placeholder={t.portalSignature.namePlaceholder}
            required
            minLength={2}
            disabled={isPending}
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="consent"
            required
            disabled={isPending}
            className="mt-1"
          />
          <span>{t.portalSignature.consentLabel}</span>
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={isPending}>
          {t.portalSignature.submit}
        </Button>
      </form>
    </section>
  );
}
