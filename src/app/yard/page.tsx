import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSessionContext } from '@/lib/auth/session';
import { listWorkshops } from '@/modules/identity/public';
import { listInboundTransfers } from '@/modules/case/public';
import {
  acceptTransferAction,
  confirmArrivalAction,
} from '@/app/actions/transfer';
import { getDictionary } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * /yard — the cross-workshop yard view (User surface, Sprint 13). Each workshop
 * sees its INBOUND transfers (initiated + in_transit) and can accept / confirm
 * arrival. This is how the receiving end of a transfer is handled. Norwegian.
 */
export default async function YardPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const t = getDictionary();
  const workshops = await listWorkshops(session.context);
  const byWorkshop = await Promise.all(
    workshops.map(async (w) => ({
      workshop: w,
      inbound: await listInboundTransfers(session.context, w.id),
    })),
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.transfer.yard}</h1>
        <Link href="/" className="text-sm underline">
          {t.common.home}
        </Link>
      </div>

      {byWorkshop.map(({ workshop, inbound }) => (
        <Card key={workshop.id}>
          <CardHeader>
            <CardTitle className="text-base">{workshop.name}</CardTitle>
            <CardDescription>
              {inbound.length} {t.transfer.yard.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inbound.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t.transfer.noInbound}
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {inbound.map(({ transfer, caseNumber }) => (
                  <li
                    key={transfer.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span>
                      <Link
                        href={`/cases/${transfer.caseId}`}
                        className="font-medium underline"
                      >
                        {caseNumber}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {transfer.status === 'initiated'
                          ? t.transfer.statusInitiated
                          : t.transfer.statusInTransit}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      {transfer.status === 'initiated' ? (
                        <form action={acceptTransferAction}>
                          <input
                            type="hidden"
                            name="caseId"
                            value={transfer.caseId}
                          />
                          <input
                            type="hidden"
                            name="transferId"
                            value={transfer.id}
                          />
                          <Button type="submit" size="sm" variant="outline">
                            {t.transfer.accept}
                          </Button>
                        </form>
                      ) : null}
                      <form action={confirmArrivalAction}>
                        <input
                          type="hidden"
                          name="caseId"
                          value={transfer.caseId}
                        />
                        <input
                          type="hidden"
                          name="transferId"
                          value={transfer.id}
                        />
                        <Button type="submit" size="sm">
                          {t.transfer.confirmArrival}
                        </Button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
