import { redirect } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { clockInAction, clockOutAction } from '@/app/actions/workforce';
import { getSessionContext } from '@/lib/auth/session';
import {
  findOpenSession,
  listEmployees,
  listWorkingNow,
} from '@/modules/workforce/public';

export const dynamic = 'force-dynamic';

const SEGMENTS = [
  ['reception', 'Mottak'],
  ['disassembly', 'Demontering'],
  ['body_repair', 'Karosseri'],
  ['paint_preparation', 'Lakkforberedelse'],
  ['paint_application', 'Lakkering'],
  ['assembly', 'Montering'],
  ['calibration_adas', 'Kalibrering'],
  ['quality_control', 'Kvalitetskontroll'],
] as const;

/**
 * /clock — mobile-first clock-in/out (User surface, Sprint 9). Glove-friendly:
 * large touch targets (≥56px), high contrast, primary actions reachable in the
 * thumb zone. A technician picks themselves + a segment and taps to clock in;
 * one big "Clock out" button when already clocked in.
 */
export default async function ClockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; employeeId?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const { error, employeeId } = await searchParams;
  const employees = await listEmployees(session.context);
  const working = await listWorkingNow(session.context);

  const selectedId = employeeId ?? employees[0]?.id ?? '';
  const open = selectedId
    ? await findOpenSession(session.context, selectedId)
    : null;

  return (
    <main className="mx-auto max-w-md space-y-5 p-4">
      <h1 className="text-2xl font-semibold">Stemple</h1>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-base text-destructive">
          {error === 'ALREADY_CLOCKED_IN'
            ? 'Du er allerede stemplet inn.'
            : error === 'NOT_CLOCKED_IN'
              ? 'Du er ikke stemplet inn.'
              : error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Velg ansatt</CardTitle>
          <CardDescription>
            {employees.length} ansatt(e). Velg deg selv.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="space-y-3">
            <select
              name="employeeId"
              defaultValue={selectedId}
              className="h-14 w-full rounded-lg border border-input bg-background px-4 text-lg"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-14 w-full rounded-lg border text-lg font-medium"
            >
              Velg
            </button>
          </form>
        </CardContent>
      </Card>

      {open ? (
        <form action={clockOutAction}>
          <input type="hidden" name="employeeId" value={selectedId} />
          <button
            type="submit"
            className="h-20 w-full rounded-xl bg-destructive text-xl font-semibold text-destructive-foreground"
          >
            Stemple ut
            <span className="block text-sm font-normal opacity-80">
              {open.segmentCode ?? 'Innstemplet'}
            </span>
          </button>
        </form>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stemple inn på</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {SEGMENTS.map(([code, label]) => (
              <form key={code} action={clockInAction}>
                <input type="hidden" name="employeeId" value={selectedId} />
                <input type="hidden" name="segmentCode" value={code} />
                <button
                  type="submit"
                  className="h-16 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground"
                >
                  {label}
                </button>
              </form>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Hvem jobber nå ({working.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {working.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {working.map((w) => (
                <li
                  key={w.employeeId}
                  className="flex items-center justify-between px-3 py-3 text-base"
                >
                  <span>{w.fullName}</span>
                  <span className="text-sm text-muted-foreground">
                    {w.segmentCode ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-muted-foreground">
              Ingen stemplet inn.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
