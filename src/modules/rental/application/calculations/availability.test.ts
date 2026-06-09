import { describe, expect, it } from 'vitest';

import {
  hasConflict,
  projectAvailability,
  type ReservationRow,
} from './availability';

describe('hasConflict', () => {
  const baseStart = new Date('2026-07-01T08:00:00Z');
  const baseEnd = new Date('2026-07-01T16:00:00Z');

  it('rejects degenerate window', () => {
    expect(
      hasConflict({ startsAt: baseEnd, endsAt: baseStart }, []),
    ).toBe(true);
  });

  it('allows non-overlapping reservations', () => {
    const existing: ReservationRow[] = [
      {
        id: 'r1',
        status: 'planned',
        startsAt: new Date('2026-07-01T16:00:00Z'),
        endsAt: new Date('2026-07-01T20:00:00Z'),
      },
    ];
    expect(
      hasConflict({ startsAt: baseStart, endsAt: baseEnd }, existing),
    ).toBe(false);
  });

  it('rejects overlapping planned reservation', () => {
    const existing: ReservationRow[] = [
      {
        id: 'r1',
        status: 'planned',
        startsAt: new Date('2026-07-01T15:00:00Z'),
        endsAt: new Date('2026-07-01T18:00:00Z'),
      },
    ];
    expect(
      hasConflict({ startsAt: baseStart, endsAt: baseEnd }, existing),
    ).toBe(true);
  });

  it('ignores cancelled and completed', () => {
    const existing: ReservationRow[] = [
      {
        id: 'r1',
        status: 'cancelled',
        startsAt: baseStart,
        endsAt: baseEnd,
      },
      {
        id: 'r2',
        status: 'completed',
        startsAt: baseStart,
        endsAt: baseEnd,
      },
    ];
    expect(
      hasConflict({ startsAt: baseStart, endsAt: baseEnd }, existing),
    ).toBe(false);
  });
});

describe('projectAvailability', () => {
  it('produces one row per day', () => {
    const days = projectAvailability(new Date('2026-07-01T00:00:00Z'), 3, []);
    expect(days).toHaveLength(3);
    expect(days[0]?.reserved).toBe(false);
  });

  it('marks reserved days correctly', () => {
    const existing: ReservationRow[] = [
      {
        id: 'r1',
        status: 'active',
        startsAt: new Date('2026-07-02T08:00:00Z'),
        endsAt: new Date('2026-07-02T18:00:00Z'),
      },
    ];
    const days = projectAvailability(
      new Date('2026-07-01T00:00:00Z'),
      3,
      existing,
    );
    expect(days[0]?.reserved).toBe(false);
    expect(days[1]?.reserved).toBe(true);
    expect(days[2]?.reserved).toBe(false);
  });
});
