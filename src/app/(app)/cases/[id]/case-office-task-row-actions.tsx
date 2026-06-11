'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  cancelOfficeTaskAction,
  completeOfficeTaskAction,
} from '@/app/actions/office-tasks';

/**
 * Inline complete + cancel actions for a single office-task row (D3 Phase E).
 */
export function CaseOfficeTaskRowActions({
  taskId,
  actionCompleteLabel,
  actionCancelLabel,
  cancelReasonPlaceholder,
  cancelReasonRequired,
}: {
  taskId: string;
  actionCompleteLabel: string;
  actionCancelLabel: string;
  cancelReasonPlaceholder: string;
  cancelReasonRequired: string;
}) {
  const [pending, startTransition] = useTransition();
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function complete(): void {
    startTransition(async () => {
      const result = await completeOfficeTaskAction({ taskId });
      if (!result.ok) setError(result.message);
    });
  }

  function cancel(): void {
    if (!reason.trim()) {
      setError(cancelReasonRequired);
      return;
    }
    startTransition(async () => {
      const result = await cancelOfficeTaskAction({ taskId, reason });
      if (!result.ok) setError(result.message);
      else {
        setShowCancel(false);
        setReason('');
      }
    });
  }

  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={complete}
          disabled={pending}
        >
          {actionCompleteLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowCancel((v) => !v)}
          disabled={pending}
        >
          {actionCancelLabel}
        </Button>
      </div>
      {showCancel ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={cancelReasonPlaceholder}
            className="h-8 w-48 text-xs"
            disabled={pending}
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={cancel}
            disabled={pending || reason.trim().length === 0}
          >
            {actionCancelLabel}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
