'use client';

import { useState, useTransition } from 'react';

import { seedDefaultTaskTemplatesAction } from '@/app/actions/task-templates';

interface Props {
  labelSeed: string;
}

export function SeedDefaultsButton({ labelSeed }: Props) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setMessage(null);
          start(async () => {
            const result = await seedDefaultTaskTemplatesAction();
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setMessage(`+${result.data.created}`);
          });
        }}
        className="rounded-md border bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
      >
        {labelSeed}
      </button>
      {message ? (
        <span className="text-sm text-green-700">{message}</span>
      ) : null}
      {error ? (
        <span className="text-sm text-red-600" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
