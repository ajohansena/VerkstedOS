import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import {
  getCurrentOrganization,
  listWorkshops,
} from '@/modules/identity/public';
import {
  listLayouts,
  listYardLocationsForLayout,
} from '@/modules/yard/public';

import { createLayoutAction, createLocationAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * `/admin/yard` — yard layout designer (Sprint 19). Admins create layouts per
 * workshop and add locations (bays, parking, storage). Gated on
 * `admin:config`. Read-only fallback shows the configured grid.
 */
export default async function AdminYardPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  const session = auth.session;
  const canConfig = await auth.can('admin:config');
  if (!canConfig) redirect('/admin');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const [workshops, layouts] = await Promise.all([
    listWorkshops(session.context),
    listLayouts(session.context),
  ]);

  const layoutWithLocations = await Promise.all(
    layouts.map(async (layout) => ({
      layout,
      locations: await listYardLocationsForLayout(session.context, layout.id),
    })),
  );

  const workshopName = (id: string): string =>
    workshops.find((w) => w.id === id)?.name ?? id;

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.yard.designerTitle}
          </h1>
          <p className="text-sm text-muted-foreground">{t.yard.description}</p>
        </div>
        <Link href="/admin" className="text-sm underline text-muted-foreground">
          {t.admin.title}
        </Link>
      </header>

      <section className="rounded-lg border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.yard.designerCreateLayout}
        </h2>
        <form
          action={createLayoutAction}
          className="grid grid-cols-1 gap-3 md:grid-cols-4"
        >
          <label className="md:col-span-1">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.yard.layoutWorkshop}
            </span>
            <select
              name="workshopId"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-1">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.yard.layoutCode}
            </span>
            <input
              type="text"
              name="code"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-1">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.yard.layoutName}
            </span>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="md:col-span-1 md:self-end">
            <button
              type="submit"
              className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {t.yard.designerSubmit}
            </button>
          </div>
        </form>
      </section>

      {layoutWithLocations.map(({ layout, locations }) => (
        <section
          key={layout.id}
          className="rounded-lg border bg-background p-4"
        >
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">
                {layout.code} · {layout.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {workshopName(layout.workshopId)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {locations.length}
            </span>
          </header>

          <form
            action={createLocationAction}
            className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-7"
          >
            <input type="hidden" name="layoutId" value={layout.id} />
            <label className="col-span-1">
              <span className="mb-1 block text-xs text-muted-foreground">
                {t.yard.locationCode}
              </span>
              <input
                type="text"
                name="code"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="col-span-1">
              <span className="mb-1 block text-xs text-muted-foreground">
                {t.yard.locationKind}
              </span>
              <select
                name="kind"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="parking">{t.yard.kindParking}</option>
                <option value="bay">{t.yard.kindBay}</option>
                <option value="storage">{t.yard.kindStorage}</option>
                <option value="temporary">{t.yard.kindTemporary}</option>
              </select>
            </label>
            <label className="col-span-1">
              <span className="mb-1 block text-xs text-muted-foreground">
                {t.yard.locationCapacity}
              </span>
              <input
                type="number"
                name="capacity"
                min={1}
                defaultValue={1}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="col-span-1">
              <span className="mb-1 block text-xs text-muted-foreground">
                {t.yard.designerRow}
              </span>
              <input
                type="number"
                name="rowIndex"
                min={0}
                defaultValue={0}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="col-span-1">
              <span className="mb-1 block text-xs text-muted-foreground">
                {t.yard.designerColumn}
              </span>
              <input
                type="number"
                name="columnIndex"
                min={0}
                defaultValue={0}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="col-span-1">
              <span className="mb-1 block text-xs text-muted-foreground">
                {t.yard.locationQrTag}
              </span>
              <input
                type="text"
                name="qrTag"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              />
            </label>
            <div className="col-span-1 self-end">
              <button
                type="submit"
                className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                {t.yard.designerCreateLocation}
              </button>
            </div>
          </form>

          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.yard.mapEmpty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">
                    {t.yard.locationCode}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {t.yard.locationKind}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {t.yard.locationCapacity}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {t.yard.locationStatus}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {t.yard.locationQrTag}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-3 font-mono text-xs">{l.code}</td>
                    <td className="py-2 pr-3">{l.kind}</td>
                    <td className="py-2 pr-3">{l.capacity}</td>
                    <td className="py-2 pr-3">{l.status}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {l.qrTag ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
