import { desc, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { clockSessions } from '@/db/schemas/workforce/clock-sessions';
import { employees } from '@/db/schemas/workforce/employees';
import { timeEntries } from '@/db/schemas/workforce/time-entries';

/**
 * Workforce inspection (Dev surface, /dev/workforce). Cross-org → service-role
 * connection. Open clock sessions + recent time-entry corrections for support
 * and audit.
 */

export interface OpenSessionRow {
  readonly id: string;
  readonly employeeName: string;
  readonly segmentCode: string | null;
  readonly startedAt: Date;
}

export async function listOpenSessions(limit = 50): Promise<OpenSessionRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: clockSessions.id,
      employeeName: employees.fullName,
      segmentCode: clockSessions.segmentCode,
      startedAt: clockSessions.startedAt,
    })
    .from(clockSessions)
    .innerJoin(employees, eq(employees.id, clockSessions.employeeId))
    .where(eq(clockSessions.status, 'open'))
    .orderBy(desc(clockSessions.startedAt))
    .limit(limit);
}

export interface CorrectionRow {
  readonly id: string;
  readonly employeeName: string;
  readonly durationMinutes: number | null;
  readonly note: string | null;
  readonly createdAt: Date;
}

export async function listTimeCorrections(
  limit = 50,
): Promise<CorrectionRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: timeEntries.id,
      employeeName: employees.fullName,
      durationMinutes: timeEntries.durationMinutes,
      note: timeEntries.note,
      createdAt: timeEntries.createdAt,
    })
    .from(timeEntries)
    .innerJoin(employees, eq(employees.id, timeEntries.employeeId))
    .where(eq(timeEntries.kind, 'correction'))
    .orderBy(desc(timeEntries.createdAt))
    .limit(limit);
}
