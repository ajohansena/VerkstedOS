'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  searchIntakeAction,
  caseFromVehicleAction,
  caseFromCustomerAction,
  quickIntakeAction,
  type IntakeSearchResult,
} from '@/app/actions/intake';

interface Labels {
  searchPlaceholder: string;
  searchHint: string;
  search: string;
  vehicles: string;
  customers: string;
  noResults: string;
  createCase: string;
  quickCreate: string;
  regNumber: string;
  customerName: string;
  customerPhone: string;
  startCase: string;
}

/**
 * Intake search (User surface). Reception starts from a registration number or
 * a phone number; matching vehicles + customers appear instantly with a
 * one-click "Opprett sak". When nothing matches, a fast create-and-open form
 * makes a customer + vehicle + case in one step. Reuses existing services.
 */
export function IntakeSearch({ labels }: { labels: Labels }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IntakeSearchResult | null>(null);
  const [pending, startTransition] = useTransition();

  const runSearch = () => {
    startTransition(async () => {
      const r = await searchIntakeAction(query);
      setResults(r);
    });
  };

  const hasResults =
    results && (results.vehicles.length > 0 || results.customers.length > 0);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
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
            placeholder={labels.searchPlaceholder}
            className="h-11"
          />
          <Button
            type="button"
            className="h-11"
            onClick={runSearch}
            disabled={pending}
          >
            {labels.search}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{labels.searchHint}</p>
      </div>

      {results ? (
        hasResults ? (
          <div className="space-y-3">
            {results.vehicles.length > 0 ? (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">{labels.vehicles}</p>
                <ul className="divide-y">
                  {results.vehicles.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">
                          {v.registrationNumber ?? '—'}
                        </span>{' '}
                        <span className="text-xs text-muted-foreground">
                          {[v.make, v.model].filter(Boolean).join(' ')}
                        </span>
                      </span>
                      <form action={caseFromVehicleAction}>
                        <input type="hidden" name="vehicleId" value={v.id} />
                        <Button type="submit" size="sm">
                          {labels.createCase}
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {results.customers.length > 0 ? (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">{labels.customers}</p>
                <ul className="divide-y">
                  {results.customers.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{c.name}</span>{' '}
                        <span className="text-xs text-muted-foreground">
                          {c.primaryPhone ?? ''}
                        </span>
                      </span>
                      <form action={caseFromCustomerAction}>
                        <input type="hidden" name="customerId" value={c.id} />
                        <Button type="submit" size="sm" variant="outline">
                          {labels.createCase}
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.noResults}</p>
        )
      ) : null}

      <form
        action={quickIntakeAction}
        className="space-y-2 rounded-md border border-dashed p-3"
      >
        <p className="text-sm font-medium">{labels.quickCreate}</p>
        <Input
          name="registrationNumber"
          placeholder={labels.regNumber}
          defaultValue={query}
        />
        <Input name="customerName" placeholder={labels.customerName} />
        <Input name="customerPhone" placeholder={labels.customerPhone} />
        <Button type="submit" className="w-full">
          {labels.startCase}
        </Button>
      </form>
    </div>
  );
}
