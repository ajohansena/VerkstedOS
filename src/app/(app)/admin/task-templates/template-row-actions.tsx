'use client';

import { useState, useTransition } from 'react';

import { setTaskTemplateActiveAction } from '@/app/actions/task-templates';

interface Props {
  templateId: string;
  isActive: boolean;
  labelEnable: string;
  labelDisable: string;
}

export function TemplateRowActions({
  templateId,
  isActive,
  labelEnable,
  labelDisable,
}: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await setTaskTemplateActiveAction({
              templateId,
              isActive: !isActive,
            });
            if (!result.ok) setError(result.message);
          });
        }}
        className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
      >
        {isActive ? labelDisable : labelEnable}
      </button>
      {error ? (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
