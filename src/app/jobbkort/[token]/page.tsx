import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAcceptanceByToken } from '@/modules/communication/public';
import {
  acceptJobCardAction,
  declineJobCardAction,
} from '@/app/actions/job-card';

export const dynamic = 'force-dynamic';

/**
 * /jobbkort/[token] — the customer's PUBLIC job card (no login). Resolved by the
 * acceptance token. The customer sees the repair summary and approves or
 * declines. Norwegian, mobile-first (this is opened from an SMS link on a
 * phone). The same record is updated whether the customer accepts here or
 * replies OK to the SMS.
 */
export default async function JobCardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const card = await getAcceptanceByToken(token);
  if (!card) notFound();

  const decided = card.status === 'accepted' || card.status === 'declined';

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Godkjenning av reparasjon</CardTitle>
          <CardDescription>Sak {card.caseNumber}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {card.summary ? (
            <div className="rounded-md border p-3 text-sm">{card.summary}</div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Verkstedet ber om din godkjenning for å starte reparasjonen.
            </p>
          )}

          {card.status === 'accepted' ? (
            <p className="rounded-md border border-green-500 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              Takk! Du har godkjent reparasjonen.
            </p>
          ) : card.status === 'declined' ? (
            <p className="rounded-md border border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              Du har avslått. Ta kontakt med verkstedet ved spørsmål.
            </p>
          ) : card.status === 'pending' ? (
            <div className="flex gap-2">
              <form action={acceptJobCardAction} className="flex-1">
                <input type="hidden" name="token" value={token} />
                <Button type="submit" className="h-12 w-full">
                  Godkjenn
                </Button>
              </form>
              <form action={declineJobCardAction} className="flex-1">
                <input type="hidden" name="token" value={token} />
                <Button type="submit" variant="outline" className="h-12 w-full">
                  Avslå
                </Button>
              </form>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Denne forespørselen er ikke lenger aktiv.
            </p>
          )}

          {!decided && card.status === 'pending' ? (
            <p className="text-center text-xs text-muted-foreground">
              Du kan også svare OK på SMS-en for å godkjenne.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
