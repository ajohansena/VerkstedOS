import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { listRecentCases } from '@/modules/case/public';
import { getCurrentOrganization } from '@/modules/identity/public';
import {
  countActivePlacementsAtLocations,
  deriveLocationStatus,
  listActivePlacementsForOrg,
  listLayouts,
  listYardLocationsForLayout,
  summarizeOccupancy,
} from '@/modules/yard/public';

import { moveVehicleAction, moveByQrAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * `/yard/map` — the physical yard map (Sprint 19, doc 13 yard reference). For
 * each layout, render a grid coloured by location status (available / occupied
 * / reserved / blocked). Tap a slot to see what's there; the bottom forms move
 * a vehicle by location or by scanning a QR tag. Mobile-first, ≥56 px targets.
 */
export default async function YardMapPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const [layouts, placements, cases] = await Promise.all([
    listLayouts(session.context),
    listActivePlacementsForOrg(session.context),
    listRecentCases(session.context, 50),
  ]);

  const placementByLocation = new Map<
    string,
    Array<{ caseNumber: string; registrationNumber: string | null }>
  >();
  for (const p of placements) {
    const arr = placementByLocation.get(p.placement.locationId) ?? [];
    arr.push({
      caseNumber: p.caseNumber,
      registrationNumber: p.registrationNumber,
    });
    placementByLocation.set(p.placement.locationId, arr);
  }

  const kindLabel = (k: string): string => {
    switch (k) {
      case 'parking':
        return t.yard.kindParking;
      case 'bay':
        return t.yard.kindBay;
      case 'storage':
        return t.yard.kindStorage;
      case 'temporary':
        return t.yard.kindTemporary;
      default:
        return k;
    }
  };
  const statusLabel = (s: string): string => {
    switch (s) {
      case 'available':
        return t.yard.statusAvailable;
      case 'occupied':
        return t.yard.statusOccupied;
      case 'reserved':
        return t.yard.statusReserved;
      case 'blocked':
        return t.yard.statusBlocked;
      default:
        return s;
    }
  };
  const statusColor = (s: string): string => {
    switch (s) {
      case 'available':
        return 'bg-emerald-100 border-emerald-300 text-emerald-900';
      case 'occupied':
        return 'bg-amber-100 border-amber-300 text-amber-900';
      case 'reserved':
        return 'bg-sky-100 border-sky-300 text-sky-900';
      case 'blocked':
        return 'bg-red-100 border-red-300 text-red-900';
      default:
        return 'bg-muted border-border';
    }
  };

  const layoutBlocks = await Promise.all(
    layouts.map(async (layout) => {
      const locations = await listYardLocationsForLayout(
        session.context,
        layout.id,
      );
      const counts = await countActivePlacementsAtLocations(
        session.context,
        locations.map((l) => l.id),
      );
      const summary = summarizeOccupancy(
        locations.map((l) => ({
          capacity: l.capacity,
          occupied: counts.get(l.id) ?? 0,
        })),
      );
      const enriched = locations.map((l) => {
        const occupied = counts.get(l.id) ?? 0;
        const derived = deriveLocationStatus(
          { capacity: l.capacity, occupied },
          l.status === 'blocked',
          l.status === 'reserved',
        );
        return { ...l, occupied, derivedStatus: derived };
      });
      return { layout, locations: enriched, summary };
    }),
  );

  return (
    <div className="mx-auto w-full max-w-[1300px] space-y-6 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.yard.mapTitle}
          </h1>
          <p className="text-sm text-muted-foreground">{t.yard.description}</p>
        </div>
        <Link href="/yard" className="text-sm text-muted-foreground underline">
          {t.transfer.yard}
        </Link>
      </header>

      {layoutBlocks.length === 0 ? (
        <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
          {t.yard.mapEmpty}
        </div>
      ) : null}

      {layoutBlocks.map(({ layout, locations, summary }) => (
        <section
          key={layout.id}
          className="rounded-lg border bg-background p-4"
        >
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {layout.code} · {layout.name}
            </h2>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>
                {t.yard.summaryCapacity}: {summary.capacity}
              </span>
              <span>
                {t.yard.summaryOccupied}: {summary.occupied}
              </span>
              <span>
                {t.yard.summaryFree}: {summary.free}
              </span>
              <span>
                {t.yard.summaryUtilization}:{' '}
                {Math.round(summary.utilization * 100)}%
              </span>
            </div>
          </header>

          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.yard.mapEmpty}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {locations.map((loc) => {
                const tenants = placementByLocation.get(loc.id) ?? [];
                return (
                  <li
                    key={loc.id}
                    className={`min-h-[64px] rounded-md border p-3 text-sm ${statusColor(loc.derivedStatus)}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold">{loc.code}</span>
                      <span className="text-[11px] opacity-80">
                        {kindLabel(loc.kind)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px]">
                      {statusLabel(loc.derivedStatus)}
                      {' · '}
                      {loc.occupied}/{loc.capacity}
                    </div>
                    {tenants.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-[11px]">
                        {tenants.map((tn) => (
                          <li key={tn.caseNumber} className="truncate">
                            <span className="font-mono">{tn.caseNumber}</span>
                            {tn.registrationNumber
                              ? ` · ${tn.registrationNumber}`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {loc.qrTag ? (
                      <div className="mt-1 truncate text-[10px] opacity-70">
                        QR: {loc.qrTag}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form
          action={moveVehicleAction}
          className="space-y-3 rounded-lg border bg-background p-4"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.yard.moveTitle}
          </h2>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.yard.moveCase}
            </span>
            <select
              name="caseId"
              required
              className="min-h-[44px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber}
                  {c.registrationNumber ? ` · ${c.registrationNumber}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.yard.moveLocation}
            </span>
            <select
              name="toLocationId"
              required
              className="min-h-[44px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {layoutBlocks.map((b) =>
                b.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {b.layout.code} · {l.code}
                  </option>
                )),
              )}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.yard.moveReason}
            </span>
            <select
              name="reason"
              className="min-h-[44px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="reposition">{t.yard.moveReasonReposition}</option>
              <option value="arrival">{t.yard.moveReasonArrival}</option>
              <option value="into_bay">{t.yard.moveReasonIntoBay}</option>
              <option value="out_of_bay">{t.yard.moveReasonOutOfBay}</option>
              <option value="into_storage">
                {t.yard.moveReasonIntoStorage}
              </option>
              <option value="departure">{t.yard.moveReasonDeparture}</option>
              <option value="correction">{t.yard.moveReasonCorrection}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.yard.moveNote}
            </span>
            <input
              type="text"
              name="note"
              className="min-h-[44px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t.yard.moveSubmit}
          </button>
        </form>

        <form
          action={moveByQrAction}
          className="space-y-3 rounded-lg border bg-background p-4"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.yard.scanTitle}
          </h2>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.yard.scanCase}
            </span>
            <select
              name="caseId"
              required
              className="min-h-[44px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber}
                  {c.registrationNumber ? ` · ${c.registrationNumber}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.yard.scanQrTag}
            </span>
            <input
              type="text"
              name="qrTag"
              inputMode="text"
              autoComplete="off"
              required
              className="min-h-[44px] w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
            />
          </label>
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t.yard.scanSubmit}
          </button>
        </form>
      </section>
    </div>
  );
}
