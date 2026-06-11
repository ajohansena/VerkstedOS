'use client';

import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createCaseFromWizardAction,
  lookup1881Action,
  lookupVegvesenAction,
  searchIntakeAction,
  type CreateCaseFromWizardInput,
  type IntakeSearchResult,
} from '@/app/actions/intake';
import {
  validateFundingSet,
  type FundingSourceInput,
  type FundingSourceKind,
} from '@/modules/case/domain/case';
import type { InsuranceCompany } from '@/db/types';
import type {
  PhoneLookupResult,
  VehicleLookupResult,
} from '@/modules/customer/public';

/**
 * Intake Wizard (User surface — D1).
 *
 * The single, adaptive intake experience. Replaces the previous split
 * "Search vs Advanced" layout. Five steps:
 *
 *   1. Vehicle       — local search → Vegvesen fallback → manual entry
 *   2. Customer      — local search → 1881 phone fallback → manual entry
 *   3. Incident      — short description
 *   4. Funding       — at least one source; multi-funding supported (5 kinds)
 *   5. Review        — confirms and creates customer + vehicle + case in one
 *                      coordinated server action (no half-created data)
 *
 * The post-create handoff in D1 routes to the new case. D2 will extend it
 * with "Plan in Production Board" (booking step) and D3 with office tasks.
 *
 * Design notes:
 *   • Each step is a small render function below — explicit branching, no
 *     state-machine library (No-Cleverness rule, doc CLAUDE.md § 4.8).
 *   • Lookups (Vegvesen, 1881) are transparent fallbacks: when not configured
 *     or when the provider fails, the wizard simply offers manual entry. The
 *     user is never blocked.
 *   • The wizard never writes a customer/vehicle until the final Review step
 *     fires `createCaseFromWizardAction`. That keeps abandoned intakes from
 *     polluting the customer/vehicle tables.
 */

export interface WizardLabels {
  step: string;
  next: string;
  previous: string;
  vehicleTitle: string;
  vehicleHint: string;
  vehicleRegPlaceholder: string;
  vehicleLookup: string;
  vehicleNoResults: string;
  vehicleFoundLocal: string;
  vehicleFoundProvider: string;
  vehicleNotConfigured: string;
  vehicleUseExisting: string;
  vehicleUseProvider: string;
  vehicleManualEntry: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColour: string;
  vehicleVin: string;
  customerTitle: string;
  customerHint: string;
  customerSearchPlaceholder: string;
  customerLookupPhone: string;
  customerNoResults: string;
  customerFoundLocal: string;
  customerFoundProvider: string;
  customerNotConfigured: string;
  customerUseExisting: string;
  customerNewIndividual: string;
  customerNewCompany: string;
  customerNewLeasing: string;
  customerNone: string;
  customerName: string;
  customerPhoneField: string;
  customerEmail: string;
  incidentTitle: string;
  incidentHint: string;
  incidentPlaceholder: string;
  fundingTitle: string;
  fundingHint: string;
  fundingAdd: string;
  fundingRemove: string;
  fundingKind: string;
  fundingLabel: string;
  fundingLabelPlaceholder: string;
  fundingKindInsurance: string;
  fundingKindPrivate: string;
  fundingKindWarranty: string;
  fundingKindGoodwill: string;
  fundingKindRework: string;
  fundingInsurer: string;
  fundingClaimNumber: string;
  fundingPayerCustomer: string;
  fundingDeductible: string;
  fundingDeductiblePayer: string;
  fundingReworkReason: string;
  fundingReferencesCase: string;
  fundingOwnerWorkshop: string;
  fundingProblem: string;
  reviewTitle: string;
  reviewVehicle: string;
  reviewCustomer: string;
  reviewIncident: string;
  reviewFunding: string;
  bookingTitle: string;
  bookingHint: string;
  bookingWorkshop: string;
  bookingArrival: string;
  bookingDelivery: string;
  bookingNotes: string;
  bookingConfirm: string;
  bookingSkip: string;
  bookingDateError: string;
  reviewSubmit: string;
  reviewSubmitting: string;
  reviewError: string;
  createdTitle: string;
  createdOpen: string;
  createdPlan: string;
  createdNewIntake: string;
}

type StepIndex = 0 | 1 | 2 | 3 | 4;

type VehicleSelection =
  | { kind: 'pending' }
  | {
      kind: 'existing';
      vehicleId: string;
      summary: string;
      ownerCustomerId: string | null;
    }
  | {
      kind: 'new';
      registrationNumber?: string;
      vin?: string;
      make?: string;
      model?: string;
      year?: number;
      colour?: string;
    };

type CustomerSelection =
  | { kind: 'pending' }
  | { kind: 'existing'; customerId: string; summary: string }
  | {
      kind: 'new';
      customerKind:
        | 'individual'
        | 'company'
        | 'leasing_company'
        | 'fleet_operator';
      name: string;
      primaryPhone?: string;
      primaryEmail?: string;
    }
  | { kind: 'none' };

/** Local-only booking draft (transient until Review-step submit). */
interface BookingDraft {
  workshopId: string;
  expectedArrivalAt: string; // datetime-local string, '' = empty
  promisedDeliveryAt: string;
  notes: string;
  confirmImmediately: boolean;
  skip: boolean;
}

export function IntakeWizard({
  labels,
  insuranceCompanies,
  workshops,
}: {
  labels: WizardLabels;
  insuranceCompanies: InsuranceCompany[];
  workshops: Array<{ id: string; name: string }>;
}) {
  const [step, setStep] = useState<StepIndex>(0);
  const [vehicle, setVehicle] = useState<VehicleSelection>({ kind: 'pending' });
  const [customer, setCustomer] = useState<CustomerSelection>({
    kind: 'pending',
  });
  const [incidentTag, setIncidentTag] = useState('');
  const [fundingSources, setFundingSources] = useState<FundingSourceInput[]>([
    blankFunding('insurance', labels),
  ]);
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdCase, setCreatedCase] = useState<{
    caseId: string;
    caseNumber: string;
  } | null>(null);

  // Optional booking captured on the Review step. `workshopId` empty means
  // "skip booking". Dates blank means no commitment yet.
  const [booking, setBooking] = useState<BookingDraft>(() => ({
    workshopId: workshops[0]?.id ?? '',
    expectedArrivalAt: '',
    promisedDeliveryAt: '',
    notes: '',
    confirmImmediately: false,
    skip: workshops.length === 0,
  }));

  const bookingProblems = useMemo<string[]>(() => {
    if (booking.skip) return [];
    if (!booking.expectedArrivalAt && !booking.promisedDeliveryAt) return [];
    if (booking.expectedArrivalAt && booking.promisedDeliveryAt) {
      const a = new Date(booking.expectedArrivalAt);
      const d = new Date(booking.promisedDeliveryAt);
      if (d.getTime() < a.getTime()) return [labels.bookingDateError];
    }
    return [];
  }, [booking, labels.bookingDateError]);

  // Per-funding-source problems (label + per-kind invariants). Reused on
  // step 3 (block Next) and step 4 (block Submit, show inline).
  const fundingProblems = useMemo<string[]>(() => {
    const problems: string[] = [];
    fundingSources.forEach((fs, i) => {
      if (!fs.label.trim()) {
        problems.push(`Funding #${i + 1}: Label is required.`);
      }
    });
    // Defer payer_customer_id check: the server backfills private_pay to the
    // primary customer when the wizard didn't capture it. Other invariants
    // still apply.
    const serverSide = validateFundingSet(
      fundingSources.map((fs) =>
        fs.kind === 'private_pay' && !fs.payerCustomerId
          ? { ...fs, payerCustomerId: '00000000-0000-0000-0000-000000000000' }
          : fs,
      ),
    );
    return [...problems, ...serverSide];
  }, [fundingSources]);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return vehicle.kind === 'existing' || vehicle.kind === 'new';
      case 1:
        return customer.kind !== 'pending';
      case 2:
        return true; // incident is optional
      case 3:
        return fundingSources.length > 0 && fundingProblems.length === 0;
      case 4:
        return fundingProblems.length === 0 && bookingProblems.length === 0;
      default:
        return false;
    }
  }, [
    step,
    vehicle,
    customer,
    fundingSources,
    fundingProblems,
    bookingProblems,
  ]);

  if (createdCase) {
    return (
      <PostCreate
        labels={labels}
        caseNumber={createdCase.caseNumber}
        caseId={createdCase.caseId}
      />
    );
  }

  const submit = () => {
    setSubmitError(null);
    if (vehicle.kind === 'pending') return;
    const input: CreateCaseFromWizardInput = {
      vehicle:
        vehicle.kind === 'existing'
          ? { kind: 'existing', vehicleId: vehicle.vehicleId }
          : {
              kind: 'new',
              ...(vehicle.registrationNumber
                ? { registrationNumber: vehicle.registrationNumber }
                : {}),
              ...(vehicle.vin ? { vin: vehicle.vin } : {}),
              ...(vehicle.make ? { make: vehicle.make } : {}),
              ...(vehicle.model ? { model: vehicle.model } : {}),
              ...(vehicle.year ? { year: vehicle.year } : {}),
              ...(vehicle.colour ? { colour: vehicle.colour } : {}),
            },
      customer:
        customer.kind === 'existing'
          ? { kind: 'existing', customerId: customer.customerId }
          : customer.kind === 'new'
            ? {
                kind: 'new',
                customerKind: customer.customerKind,
                name: customer.name,
                ...(customer.primaryPhone
                  ? { primaryPhone: customer.primaryPhone }
                  : {}),
                ...(customer.primaryEmail
                  ? { primaryEmail: customer.primaryEmail }
                  : {}),
              }
            : { kind: 'none' },
      ...(incidentTag.trim() ? { incidentTag: incidentTag.trim() } : {}),
      fundingSources,
      ...(booking.skip || !booking.workshopId
        ? {}
        : booking.expectedArrivalAt || booking.promisedDeliveryAt
          ? {
              booking: {
                workshopId: booking.workshopId,
                ...(booking.expectedArrivalAt
                  ? { expectedArrivalAt: booking.expectedArrivalAt }
                  : {}),
                ...(booking.promisedDeliveryAt
                  ? { promisedDeliveryAt: booking.promisedDeliveryAt }
                  : {}),
                ...(booking.notes.trim()
                  ? { notes: booking.notes.trim() }
                  : {}),
                ...(booking.confirmImmediately
                  ? { confirmImmediately: true }
                  : {}),
              },
            }
          : {}),
    };
    startSubmit(async () => {
      try {
        const result = await createCaseFromWizardAction(input);
        if (result.ok) {
          setCreatedCase({
            caseId: result.caseId,
            caseNumber: result.caseNumber,
          });
        } else {
          setSubmitError(result.message || labels.reviewError);
        }
      } catch (err) {
        // Network / unexpected runtime failures only — the action itself never
        // throws (returns a tagged union). Fall back to a generic message.
        setSubmitError(
          err instanceof Error && err.message
            ? err.message
            : labels.reviewError,
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <StepIndicator step={step} labels={labels} />

      {step === 0 && (
        <VehicleStep
          labels={labels}
          selection={vehicle}
          onSelect={setVehicle}
        />
      )}
      {step === 1 && (
        <CustomerStep
          labels={labels}
          selection={customer}
          onSelect={setCustomer}
          presetCustomerId={
            vehicle.kind === 'existing' ? vehicle.ownerCustomerId : null
          }
        />
      )}
      {step === 2 && (
        <IncidentStep
          labels={labels}
          value={incidentTag}
          onChange={setIncidentTag}
        />
      )}
      {step === 3 && (
        <FundingStep
          labels={labels}
          sources={fundingSources}
          onChange={setFundingSources}
          insuranceCompanies={insuranceCompanies}
          problems={fundingProblems}
        />
      )}
      {step === 4 && (
        <>
          <ReviewStep
            labels={labels}
            vehicle={vehicle}
            customer={customer}
            incidentTag={incidentTag}
            fundingSources={fundingSources}
            insuranceCompanies={insuranceCompanies}
          />
          <BookingSection
            labels={labels}
            workshops={workshops}
            value={booking}
            onChange={setBooking}
            problems={bookingProblems}
          />
        </>
      )}

      {step === 4 && fundingProblems.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {fundingProblems.map((p, i) => (
            <li key={i}>• {p}</li>
          ))}
        </ul>
      ) : null}

      {submitError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex gap-2">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setStep((s) => (s > 0 ? ((s - 1) as StepIndex) : s))
              }
              disabled={submitting}
            >
              {labels.previous}
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          {step < 4 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => (s + 1) as StepIndex)}
              disabled={!canAdvance}
            >
              {labels.next}
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? labels.reviewSubmitting : labels.reviewSubmit}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── Step indicator ─────────────────────────────

function StepIndicator({
  step,
  labels,
}: {
  step: StepIndex;
  labels: WizardLabels;
}) {
  const titles = [
    labels.vehicleTitle,
    labels.customerTitle,
    labels.incidentTitle,
    labels.fundingTitle,
    labels.reviewTitle,
  ];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {titles.map((title, i) => (
        <li
          key={title}
          className={`rounded-full border px-3 py-1 ${
            i === step
              ? 'border-primary bg-primary text-primary-foreground'
              : i < step
                ? 'border-muted-foreground/30 bg-muted text-muted-foreground'
                : 'border-muted-foreground/20 text-muted-foreground'
          }`}
        >
          {labels.step} {i + 1}: {title}
        </li>
      ))}
    </ol>
  );
}

// ───────────────────────────── Vehicle step ──────────────────────────────

function VehicleStep({
  labels,
  selection,
  onSelect,
}: {
  labels: WizardLabels;
  selection: VehicleSelection;
  onSelect: (s: VehicleSelection) => void;
}) {
  const [reg, setReg] = useState('');
  const [results, setResults] = useState<IntakeSearchResult | null>(null);
  const [vegvesen, setVegvesen] = useState<VehicleLookupResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [manual, setManual] = useState<{
    make: string;
    model: string;
    year: string;
    colour: string;
    vin: string;
  }>({ make: '', model: '', year: '', colour: '', vin: '' });
  const [manualOpen, setManualOpen] = useState(false);

  const runLookup = () => {
    const q = reg.trim();
    if (!q) return;
    setResults(null);
    setVegvesen(null);
    startSearch(async () => {
      const local = await searchIntakeAction(q);
      setResults(local);
      // Only call Vegvesen if no local hit AND query looks like a plate
      if (local.vehicles.length === 0 && /^[A-Za-z]{2}\s?\d{3,5}$/.test(q)) {
        const v = await lookupVegvesenAction(q);
        setVegvesen(v);
      }
    });
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{labels.vehicleTitle}</h2>
        <p className="text-sm text-muted-foreground">{labels.vehicleHint}</p>
      </header>

      <div className="flex gap-2">
        <Input
          value={reg}
          onChange={(e) => setReg(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runLookup();
            }
          }}
          placeholder={labels.vehicleRegPlaceholder}
          className="font-mono"
          autoFocus
        />
        <Button type="button" onClick={runLookup} disabled={searching}>
          {labels.vehicleLookup}
        </Button>
      </div>

      {results && results.vehicles.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-emerald-700">
            {labels.vehicleFoundLocal}
          </p>
          <ul className="divide-y rounded-md border">
            {results.vehicles.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-mono">{v.registrationNumber}</span>{' '}
                  {[v.make, v.model].filter(Boolean).join(' ')}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    selection.kind === 'existing' &&
                    selection.vehicleId === v.id
                      ? 'default'
                      : 'outline'
                  }
                  onClick={() =>
                    onSelect({
                      kind: 'existing',
                      vehicleId: v.id,
                      summary:
                        `${v.registrationNumber ?? ''} ${[v.make, v.model].filter(Boolean).join(' ')}`.trim(),
                      ownerCustomerId: v.ownerCustomerId,
                    })
                  }
                >
                  {labels.vehicleUseExisting}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {vegvesen && vegvesen.found ? (
        <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm">
          <p className="font-medium text-blue-900">
            {labels.vehicleFoundProvider}
          </p>
          <p className="text-blue-800">
            <span className="font-mono">{vegvesen.registrationNumber}</span>
            {vegvesen.make ? ` · ${vegvesen.make}` : ''}
            {vegvesen.model ? ` ${vegvesen.model}` : ''}
            {vegvesen.year ? ` (${vegvesen.year})` : ''}
            {vegvesen.colour ? ` · ${vegvesen.colour}` : ''}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            variant={
              selection.kind === 'new' &&
              selection.registrationNumber === vegvesen.registrationNumber
                ? 'default'
                : 'outline'
            }
            onClick={() =>
              onSelect({
                kind: 'new',
                registrationNumber: vegvesen.registrationNumber,
                ...(vegvesen.make ? { make: vegvesen.make } : {}),
                ...(vegvesen.model ? { model: vegvesen.model } : {}),
                ...(vegvesen.year ? { year: vegvesen.year } : {}),
                ...(vegvesen.colour ? { colour: vegvesen.colour } : {}),
                ...(vegvesen.vin ? { vin: vegvesen.vin } : {}),
              })
            }
          >
            {labels.vehicleUseProvider}
          </Button>
        </div>
      ) : null}

      {vegvesen && !vegvesen.found && vegvesen.source === 'not_configured' ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {labels.vehicleNotConfigured}
        </p>
      ) : null}

      {results &&
      results.vehicles.length === 0 &&
      (vegvesen ? !vegvesen.found : true) ? (
        <p className="text-sm text-muted-foreground">
          {labels.vehicleNoResults}
        </p>
      ) : null}

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setManualOpen((v) => !v)}
        >
          {labels.vehicleManualEntry}
        </Button>
      </div>

      {manualOpen ? (
        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
          <Input
            placeholder={labels.vehicleMake}
            value={manual.make}
            onChange={(e) => setManual({ ...manual, make: e.target.value })}
          />
          <Input
            placeholder={labels.vehicleModel}
            value={manual.model}
            onChange={(e) => setManual({ ...manual, model: e.target.value })}
          />
          <Input
            placeholder={labels.vehicleYear}
            type="number"
            value={manual.year}
            onChange={(e) => setManual({ ...manual, year: e.target.value })}
          />
          <Input
            placeholder={labels.vehicleColour}
            value={manual.colour}
            onChange={(e) => setManual({ ...manual, colour: e.target.value })}
          />
          <Input
            placeholder={labels.vehicleVin}
            value={manual.vin}
            onChange={(e) => setManual({ ...manual, vin: e.target.value })}
            className="font-mono sm:col-span-2"
          />
          <Button
            type="button"
            className="sm:col-span-2"
            onClick={() => {
              const year = Number.parseInt(manual.year, 10);
              onSelect({
                kind: 'new',
                ...(reg.trim() ? { registrationNumber: reg.trim() } : {}),
                ...(manual.make ? { make: manual.make } : {}),
                ...(manual.model ? { model: manual.model } : {}),
                ...(Number.isFinite(year) && year > 1900 ? { year } : {}),
                ...(manual.colour ? { colour: manual.colour } : {}),
                ...(manual.vin ? { vin: manual.vin } : {}),
              });
            }}
          >
            {labels.vehicleManualEntry}
          </Button>
        </div>
      ) : null}

      {selection.kind !== 'pending' ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          ✓ {summarizeVehicleSelection(selection)}
        </p>
      ) : null}
    </section>
  );
}

// ──────────────────────────── Customer step ──────────────────────────────

function CustomerStep({
  labels,
  selection,
  onSelect,
  presetCustomerId,
}: {
  labels: WizardLabels;
  selection: CustomerSelection;
  onSelect: (s: CustomerSelection) => void;
  presetCustomerId: string | null;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IntakeSearchResult | null>(null);
  const [phone1881, setPhone1881] = useState<PhoneLookupResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<{
    kind: 'individual' | 'company' | 'leasing_company' | 'fleet_operator';
    name: string;
    phone: string;
    email: string;
  }>({ kind: 'individual', name: '', phone: '', email: '' });

  // Auto-select preset when vehicle already has an owner.
  if (
    presetCustomerId &&
    selection.kind === 'pending' &&
    (!results || results.customers.length === 0)
  ) {
    // Don't fight the user — only auto-fill the query field.
  }

  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    setResults(null);
    setPhone1881(null);
    startSearch(async () => {
      const local = await searchIntakeAction(q);
      setResults(local);
      // Phone lookup when nothing matched and query looks like a phone.
      if (
        local.customers.length === 0 &&
        /^[+\d][\d\s]{6,}$/.test(q.replace(/\s/g, ''))
      ) {
        const p = await lookup1881Action(q);
        setPhone1881(p);
      }
    });
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{labels.customerTitle}</h2>
        <p className="text-sm text-muted-foreground">{labels.customerHint}</p>
      </header>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runSearch();
            }
          }}
          placeholder={labels.customerSearchPlaceholder}
        />
        <Button type="button" onClick={runSearch} disabled={searching}>
          {labels.vehicleLookup}
        </Button>
      </div>

      {results && results.customers.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-emerald-700">
            {labels.customerFoundLocal}
          </p>
          <ul className="divide-y rounded-md border">
            {results.customers.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{c.name}</span>
                  {c.primaryPhone ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {c.primaryPhone}
                    </span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    selection.kind === 'existing' &&
                    selection.customerId === c.id
                      ? 'default'
                      : 'outline'
                  }
                  onClick={() =>
                    onSelect({
                      kind: 'existing',
                      customerId: c.id,
                      summary: c.name,
                    })
                  }
                >
                  {labels.customerUseExisting}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {phone1881 && phone1881.found ? (
        <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm">
          <p className="font-medium text-blue-900">
            {labels.customerFoundProvider}
          </p>
          <p className="text-blue-800">
            {phone1881.name ?? phone1881.phone}
            {phone1881.address ? ` · ${phone1881.address}` : ''}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            variant={
              selection.kind === 'new' && selection.name === phone1881.name
                ? 'default'
                : 'outline'
            }
            onClick={() =>
              onSelect({
                kind: 'new',
                customerKind: 'individual',
                name: phone1881.name ?? phone1881.phone,
                primaryPhone: phone1881.phone,
              })
            }
          >
            {labels.customerUseExisting}
          </Button>
        </div>
      ) : null}

      {phone1881 &&
      !phone1881.found &&
      phone1881.source === 'not_configured' ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {labels.customerNotConfigured}
        </p>
      ) : null}

      {results &&
      results.customers.length === 0 &&
      (phone1881 ? !phone1881.found : true) ? (
        <p className="text-sm text-muted-foreground">
          {labels.customerNoResults}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setManual({ ...manual, kind: 'individual' });
            setManualOpen(true);
          }}
        >
          + {labels.customerNewIndividual}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setManual({ ...manual, kind: 'company' });
            setManualOpen(true);
          }}
        >
          + {labels.customerNewCompany}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSelect({ kind: 'none' })}
        >
          {labels.customerNone}
        </Button>
      </div>

      {manualOpen ? (
        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
          <Input
            placeholder={labels.customerName}
            value={manual.name}
            onChange={(e) => setManual({ ...manual, name: e.target.value })}
            className="sm:col-span-2"
          />
          <Input
            placeholder={labels.customerPhoneField}
            value={manual.phone}
            onChange={(e) => setManual({ ...manual, phone: e.target.value })}
          />
          <Input
            placeholder={labels.customerEmail}
            value={manual.email}
            type="email"
            onChange={(e) => setManual({ ...manual, email: e.target.value })}
          />
          <Button
            type="button"
            className="sm:col-span-2"
            disabled={!manual.name.trim()}
            onClick={() =>
              onSelect({
                kind: 'new',
                customerKind: manual.kind,
                name: manual.name.trim(),
                ...(manual.phone.trim()
                  ? { primaryPhone: manual.phone.trim() }
                  : {}),
                ...(manual.email.trim()
                  ? { primaryEmail: manual.email.trim() }
                  : {}),
              })
            }
          >
            {manual.kind === 'company'
              ? labels.customerNewCompany
              : labels.customerNewIndividual}
          </Button>
        </div>
      ) : null}

      {selection.kind !== 'pending' ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          ✓ {summarizeCustomerSelection(selection, labels)}
        </p>
      ) : null}
    </section>
  );
}

// ──────────────────────────── Incident step ──────────────────────────────

function IncidentStep({
  labels,
  value,
  onChange,
}: {
  labels: WizardLabels;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{labels.incidentTitle}</h2>
        <p className="text-sm text-muted-foreground">{labels.incidentHint}</p>
      </header>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={labels.incidentPlaceholder}
        autoFocus
      />
    </section>
  );
}

// ───────────────────────────── Funding step ──────────────────────────────

function FundingStep({
  labels,
  sources,
  onChange,
  insuranceCompanies,
  problems,
}: {
  labels: WizardLabels;
  sources: FundingSourceInput[];
  onChange: (s: FundingSourceInput[]) => void;
  insuranceCompanies: InsuranceCompany[];
  problems: string[];
}) {
  const update = (i: number, patch: Partial<FundingSourceInput>) => {
    onChange(
      sources.map((s, idx) => {
        if (idx !== i) return s;
        // When the user changes kind, re-default the label IF the current
        // label is empty or is the previous kind's default — so an empty row
        // can never reach the server (Zod min(1) on label).
        if (patch.kind && patch.kind !== s.kind) {
          const prevDefault = defaultLabelForKind(s.kind, labels);
          const labelIsDefault = !s.label.trim() || s.label === prevDefault;
          return {
            ...s,
            ...patch,
            label: labelIsDefault
              ? defaultLabelForKind(patch.kind, labels)
              : s.label,
          };
        }
        return { ...s, ...patch };
      }),
    );
  };
  const remove = (i: number) => {
    onChange(sources.filter((_, idx) => idx !== i));
  };
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{labels.fundingTitle}</h2>
        <p className="text-sm text-muted-foreground">{labels.fundingHint}</p>
      </header>

      <div className="space-y-3">
        {sources.map((s, i) => (
          <FundingRow
            key={i}
            labels={labels}
            value={s}
            insuranceCompanies={insuranceCompanies}
            onChange={(patch) => update(i, patch)}
            onRemove={sources.length > 1 ? () => remove(i) : null}
          />
        ))}
      </div>

      {problems.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {problems.map((p, i) => (
            <li key={i}>• {p}</li>
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...sources, blankFunding('insurance', labels)])
        }
      >
        + {labels.fundingAdd}
      </Button>
    </section>
  );
}

function FundingRow({
  labels,
  value,
  insuranceCompanies,
  onChange,
  onRemove,
}: {
  labels: WizardLabels;
  value: FundingSourceInput;
  insuranceCompanies: InsuranceCompany[];
  onChange: (patch: Partial<FundingSourceInput>) => void;
  onRemove: (() => void) | null;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={value.kind}
          onChange={(e) =>
            onChange({ kind: e.target.value as FundingSourceKind })
          }
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="insurance">{labels.fundingKindInsurance}</option>
          <option value="private_pay">{labels.fundingKindPrivate}</option>
          <option value="warranty">{labels.fundingKindWarranty}</option>
          <option value="goodwill">{labels.fundingKindGoodwill}</option>
          <option value="internal_rework">{labels.fundingKindRework}</option>
        </select>
        <Input
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={labels.fundingLabelPlaceholder}
          className="flex-1"
        />
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive"
          >
            {labels.fundingRemove}
          </Button>
        ) : null}
      </div>

      {value.kind === 'insurance' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={value.newClaim?.insuranceCompanyId ?? ''}
            onChange={(e) =>
              onChange({
                newClaim: {
                  ...(value.newClaim ?? {}),
                  ...(e.target.value
                    ? { insuranceCompanyId: e.target.value }
                    : { insuranceCompanyId: undefined }),
                },
              })
            }
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— {labels.fundingInsurer} —</option>
            {insuranceCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Input
            value={value.newClaim?.claimNumber ?? ''}
            onChange={(e) =>
              onChange({
                newClaim: {
                  ...(value.newClaim ?? {}),
                  claimNumber: e.target.value || undefined,
                },
              })
            }
            placeholder={labels.fundingClaimNumber}
          />
        </div>
      ) : null}

      {value.kind === 'private_pay' ? (
        <p className="text-xs text-muted-foreground">
          {labels.fundingPayerCustomer}: vil bli satt til kundens på sak-siden.
        </p>
      ) : null}

      {value.kind === 'internal_rework' ? (
        <Input
          value={value.reworkReason ?? ''}
          onChange={(e) =>
            onChange({ reworkReason: e.target.value || undefined })
          }
          placeholder={labels.fundingReworkReason}
        />
      ) : null}
    </div>
  );
}

// ────────────────────────────── Review step ──────────────────────────────

function ReviewStep({
  labels,
  vehicle,
  customer,
  incidentTag,
  fundingSources,
  insuranceCompanies,
}: {
  labels: WizardLabels;
  vehicle: VehicleSelection;
  customer: CustomerSelection;
  incidentTag: string;
  fundingSources: FundingSourceInput[];
  insuranceCompanies: InsuranceCompany[];
}) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{labels.reviewTitle}</h2>
      </header>
      <dl className="space-y-3 rounded-md border p-4 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {labels.reviewVehicle}
          </dt>
          <dd>{summarizeVehicleSelection(vehicle)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {labels.reviewCustomer}
          </dt>
          <dd>{summarizeCustomerSelection(customer, labels)}</dd>
        </div>
        {incidentTag.trim() ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labels.reviewIncident}
            </dt>
            <dd>{incidentTag}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {labels.reviewFunding} ({fundingSources.length})
          </dt>
          <dd>
            <ul className="space-y-1">
              {fundingSources.map((f, i) => (
                <li key={i}>
                  • {kindLabel(f.kind, labels)} — {f.label}
                  {f.kind === 'insurance' && f.newClaim?.insuranceCompanyId
                    ? ` (${insuranceCompanies.find((c) => c.id === f.newClaim?.insuranceCompanyId)?.name ?? ''})`
                    : ''}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </section>
  );
}

// ──────────────────────────── Booking section ────────────────────────────

function BookingSection({
  labels,
  workshops,
  value,
  onChange,
  problems,
}: {
  labels: WizardLabels;
  workshops: Array<{ id: string; name: string }>;
  value: BookingDraft;
  onChange: (next: BookingDraft) => void;
  problems: string[];
}) {
  // When the user has no workshops to book against, hide the section entirely
  // (the action will simply not create a booking).
  if (workshops.length === 0) return null;

  const update = (patch: Partial<BookingDraft>) =>
    onChange({ ...value, ...patch });

  return (
    <section className="space-y-3 rounded-md border p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{labels.bookingTitle}</h2>
          <p className="text-xs text-muted-foreground">{labels.bookingHint}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={value.skip}
            onChange={(e) => update({ skip: e.target.checked })}
          />
          {labels.bookingSkip}
        </label>
      </header>

      {value.skip ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium">
              {labels.bookingWorkshop}
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={value.workshopId}
              onChange={(e) => update({ workshopId: e.target.value })}
            >
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="booking-arrival">
              {labels.bookingArrival}
            </label>
            <Input
              id="booking-arrival"
              type="datetime-local"
              value={value.expectedArrivalAt}
              onChange={(e) => update({ expectedArrivalAt: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="booking-delivery">
              {labels.bookingDelivery}
            </label>
            <Input
              id="booking-delivery"
              type="datetime-local"
              value={value.promisedDeliveryAt}
              onChange={(e) => update({ promisedDeliveryAt: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium" htmlFor="booking-notes">
              {labels.bookingNotes}
            </label>
            <Input
              id="booking-notes"
              value={value.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={value.confirmImmediately}
              onChange={(e) => update({ confirmImmediately: e.target.checked })}
            />
            {labels.bookingConfirm}
          </label>
          {problems.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2">
              {problems.map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}

// ───────────────────────────── Post-create ───────────────────────────────

function PostCreate({
  labels,
  caseNumber,
  caseId,
}: {
  labels: WizardLabels;
  caseNumber: string;
  caseId: string;
}) {
  return (
    <div className="space-y-4 rounded-md border border-emerald-300 bg-emerald-50 p-6 text-center">
      <h2 className="text-xl font-semibold text-emerald-900">
        {labels.createdTitle.replace('{caseNumber}', caseNumber)}
      </h2>
      <div className="flex flex-wrap justify-center gap-2">
        <a href={`/cases/${caseId}`}>
          <Button type="button">{labels.createdOpen}</Button>
        </a>
        <a href={`/production?openBooking=${caseId}`}>
          <Button type="button" variant="outline">
            {labels.createdPlan}
          </Button>
        </a>
        <a href="/cases/new">
          <Button type="button" variant="ghost">
            {labels.createdNewIntake}
          </Button>
        </a>
      </div>
    </div>
  );
}

// ───────────────────────────── Helpers ───────────────────────────────────

function defaultLabelForKind(
  kind: FundingSourceKind,
  labels: WizardLabels,
): string {
  return kindLabel(kind, labels);
}

function blankFunding(
  kind: FundingSourceKind,
  labels: WizardLabels,
): FundingSourceInput {
  return { kind, label: defaultLabelForKind(kind, labels) };
}

function summarizeVehicleSelection(s: VehicleSelection): string {
  if (s.kind === 'existing') return s.summary || s.vehicleId;
  if (s.kind === 'new') {
    return (
      [s.registrationNumber, s.make, s.model, s.year]
        .filter(Boolean)
        .join(' ') || '—'
    );
  }
  return '—';
}

function summarizeCustomerSelection(
  s: CustomerSelection,
  labels: WizardLabels,
): string {
  if (s.kind === 'existing') return s.summary;
  if (s.kind === 'new')
    return `${s.name}${s.primaryPhone ? ` · ${s.primaryPhone}` : ''}`;
  if (s.kind === 'none') return labels.customerNone;
  return '—';
}

function kindLabel(k: FundingSourceKind, labels: WizardLabels): string {
  switch (k) {
    case 'insurance':
      return labels.fundingKindInsurance;
    case 'private_pay':
      return labels.fundingKindPrivate;
    case 'warranty':
      return labels.fundingKindWarranty;
    case 'goodwill':
      return labels.fundingKindGoodwill;
    case 'internal_rework':
      return labels.fundingKindRework;
  }
}
