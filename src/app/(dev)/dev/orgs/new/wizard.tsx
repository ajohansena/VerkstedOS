'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { provisionOrganizationAction } from '../actions';

type Step = 1 | 2 | 3 | 4;

const INITIAL_STATE = { ok: false, message: '' } as const;

/**
 * Guided org-creation wizard (Sprint 20 — Platform Maturity).
 *
 * Four steps: org details → first workshop → first Owner → review & submit.
 * On success the page redirects to `/dev/orgs/[id]`. The form submits the
 * whole payload at once (single transaction in the service) — the steps are
 * UX only, not separate writes.
 */
export default function ProvisionOrgWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [orgName, setOrgName] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [workshopName, setWorkshopName] = useState('');
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [state, formAction, pending] = useActionState(
    provisionOrganizationAction,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state, router]);

  const canNext1 = orgName.trim().length > 0;
  const canNext2 = workshopName.trim().length > 0;
  const canNext3 =
    ownerFullName.trim().length > 0 && /\S+@\S+\.\S+/.test(ownerEmail);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step {step} of 4</CardTitle>
        <CardDescription>
          {step === 1 && 'Organization details'}
          {step === 2 && 'First workshop'}
          {step === 3 && 'First Owner'}
          {step === 4 && 'Review and create'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="orgName" value={orgName} />
          <input type="hidden" name="orgNumber" value={orgNumber} />
          <input type="hidden" name="workshopName" value={workshopName} />
          <input type="hidden" name="ownerFullName" value={ownerFullName} />
          <input type="hidden" name="ownerEmail" value={ownerEmail} />

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="orgName-input">
                  Organization name *
                </label>
                <Input
                  id="orgName-input"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Johansen Bilskade AS"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="orgNumber-input"
                >
                  Org number (Brønnøysund)
                </label>
                <Input
                  id="orgNumber-input"
                  value={orgNumber}
                  onChange={(e) => setOrgNumber(e.target.value)}
                  placeholder="9 digits, optional"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="workshopName-input"
              >
                Workshop name *
              </label>
              <Input
                id="workshopName-input"
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                placeholder="e.g. Hovedverkstedet, Hagen"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Every organization starts with one workshop. More can be added
                later from the customer Admin UI.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="ownerName-input"
                >
                  Full name *
                </label>
                <Input
                  id="ownerName-input"
                  value={ownerFullName}
                  onChange={(e) => setOwnerFullName(e.target.value)}
                  placeholder="e.g. Anders Johansen"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="ownerEmail-input"
                >
                  Email *
                </label>
                <Input
                  id="ownerEmail-input"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@example.com"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  An invite email with a magic link will be sent here. This user
                  receives the customer-org <code>owner</code> role.
                  <strong> Never </strong>the platform PlatformOwner role.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-sm">
              <SummaryRow label="Organization" value={orgName} />
              {orgNumber && <SummaryRow label="Org number" value={orgNumber} />}
              <SummaryRow label="First workshop" value={workshopName} />
              <SummaryRow label="Owner" value={ownerFullName} />
              <SummaryRow label="Owner email" value={ownerEmail} />
              {state.message && !state.ok && (
                <p className="rounded-md border border-destructive bg-destructive/10 p-2 text-destructive">
                  {state.message}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={step === 1 || pending}
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
            >
              Back
            </Button>
            {step < 4 ? (
              <Button
                type="button"
                disabled={
                  (step === 1 && !canNext1) ||
                  (step === 2 && !canNext2) ||
                  (step === 3 && !canNext3)
                }
                onClick={() => setStep((s) => (s + 1) as Step)}
              >
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={pending}>
                {pending ? 'Provisioning…' : 'Create organization'}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
