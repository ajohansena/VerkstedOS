import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getSessionContext } from '@/lib/auth/session';
import {
  listProductionBoard,
  type BoardItem,
} from '@/modules/production/public';

export const dynamic = 'force-dynamic';

const COLOR: Record<string, string> = {
  green: 'border-l-4 border-l-green-500',
  yellow: 'border-l-4 border-l-yellow-500',
  red: 'border-l-4 border-l-red-500',
  grey: 'border-l-4 border-l-slate-400',
};

/**
 * /production — the production board (User surface, Sprint 8 basic list).
 *
 * Cases grouped by their current (PROJECTED) workflow state, color-coded by
 * category. The state shown is a projection of the append-only transition log,
 * not a hand-maintained field.
 */
export default async function ProductionBoardPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const board = await listProductionBoard(session.context);

  // Group by state label for a simple column-less board (MVP list view).
  const groups = new Map<string, BoardItem[]>();
  for (const item of board) {
    const key = item.stateLabel ?? 'No production order';
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Production board</h1>
        <Link href="/" className="text-sm underline">
          Home
        </Link>
      </div>

      {board.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No cases in production yet. Open a case and start its production
          order.
        </p>
      ) : (
        [...groups.entries()].map(([label, items]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription>{items.length} case(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.caseId}>
                    <Link
                      href={`/cases/${item.caseId}`}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50 ${
                        COLOR[item.colorHint ?? 'grey'] ?? COLOR['grey']
                      }`}
                    >
                      <span className="font-medium">{item.caseNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.category}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </main>
  );
}
