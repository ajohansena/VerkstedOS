import { describe, expect, it } from 'vitest';

import {
  DELIVERY_AT_RISK_DEFAULTS,
  PARTS_DELAY_DEFAULTS,
  SUPPLEMENT_PENDING_DEFAULTS,
  detectDeliveryAtRisk,
  detectPartsDelay,
  detectSupplementPending,
} from './triggers';

const NOW = new Date('2026-06-20T10:00:00Z');

describe('detectPartsDelay', () => {
  it('does not fire below the threshold', () => {
    const oneDayAgo = new Date(NOW.getTime() - 1 * 86400000);
    const hits = detectPartsDelay(
      [
        {
          caseId: 'c1',
          caseNumber: '2026-0001',
          workshopId: 'w1',
          requirementId: 'r1',
          partName: 'Frontskjerm',
          flaggedAt: oneDayAgo,
          progressed: false,
          recipientUserIds: ['u1'],
        },
      ],
      PARTS_DELAY_DEFAULTS,
      NOW,
    );
    expect(hits).toHaveLength(0);
  });

  it('fires when threshold exceeded and not progressed', () => {
    const fourDaysAgo = new Date(NOW.getTime() - 4 * 86400000);
    const hits = detectPartsDelay(
      [
        {
          caseId: 'c1',
          caseNumber: '2026-0001',
          workshopId: 'w1',
          requirementId: 'r1',
          partName: 'Frontskjerm',
          flaggedAt: fourDaysAgo,
          progressed: false,
          recipientUserIds: ['u1'],
        },
      ],
      PARTS_DELAY_DEFAULTS,
      NOW,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]?.ruleCode).toBe('parts_delay');
    expect(hits[0]?.severity).toBe('warning');
    expect(hits[0]?.refType).toBe('part_requirement');
    expect(hits[0]?.actionUrl).toBe('/cases/c1#parts');
    expect(hits[0]?.payload['days']).toBe(4);
  });

  it('does not fire when requirement has progressed', () => {
    const fourDaysAgo = new Date(NOW.getTime() - 4 * 86400000);
    const hits = detectPartsDelay(
      [
        {
          caseId: 'c1',
          caseNumber: '2026-0001',
          workshopId: 'w1',
          requirementId: 'r1',
          partName: 'Frontskjerm',
          flaggedAt: fourDaysAgo,
          progressed: true,
          recipientUserIds: ['u1'],
        },
      ],
      PARTS_DELAY_DEFAULTS,
      NOW,
    );
    expect(hits).toHaveLength(0);
  });

  it('respects custom threshold parameter', () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * 86400000);
    const hits = detectPartsDelay(
      [
        {
          caseId: 'c1',
          caseNumber: '2026-0001',
          workshopId: 'w1',
          requirementId: 'r1',
          partName: 'Frontskjerm',
          flaggedAt: twoDaysAgo,
          progressed: false,
          recipientUserIds: ['u1'],
        },
      ],
      { thresholdDays: 1 },
      NOW,
    );
    expect(hits).toHaveLength(1);
  });
});

describe('detectSupplementPending', () => {
  it('fires when supplement has been unsettled past threshold', () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 86400000);
    const hits = detectSupplementPending(
      [
        {
          caseId: 'c1',
          caseNumber: '2026-0001',
          workshopId: 'w1',
          supplementId: 's1',
          raisedAt: threeDaysAgo,
          settled: false,
          recipientUserIds: ['u1'],
        },
      ],
      SUPPLEMENT_PENDING_DEFAULTS,
      NOW,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]?.ruleCode).toBe('supplement_pending');
    expect(hits[0]?.refType).toBe('estimate_supplement');
  });

  it('does not fire once settled', () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 86400000);
    const hits = detectSupplementPending(
      [
        {
          caseId: 'c1',
          caseNumber: '2026-0001',
          workshopId: 'w1',
          supplementId: 's1',
          raisedAt: threeDaysAgo,
          settled: true,
          recipientUserIds: ['u1'],
        },
      ],
      SUPPLEMENT_PENDING_DEFAULTS,
      NOW,
    );
    expect(hits).toHaveLength(0);
  });
});

describe('detectDeliveryAtRisk', () => {
  it('fires when forecast slips past promised by at least min slip', () => {
    const promised = new Date('2026-06-25T12:00:00Z');
    const forecast = new Date('2026-06-27T12:00:00Z'); // +48h slip
    const hits = detectDeliveryAtRisk(
      [
        {
          caseId: 'c1',
          caseNumber: '2026-0001',
          workshopId: 'w1',
          promisedAt: promised,
          forecastAt: forecast,
          recipientUserIds: ['u1'],
        },
      ],
      DELIVERY_AT_RISK_DEFAULTS,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]?.ruleCode).toBe('delivery_at_risk');
    expect(hits[0]?.severity).toBe('critical');
    expect(hits[0]?.payload['slipHours']).toBe(48);
  });

  it('does not fire when slip below min', () => {
    const promised = new Date('2026-06-25T12:00:00Z');
    const forecast = new Date('2026-06-26T00:00:00Z'); // +12h
    const hits = detectDeliveryAtRisk(
      [
        {
          caseId: 'c1',
          caseNumber: '2026-0001',
          workshopId: 'w1',
          promisedAt: promised,
          forecastAt: forecast,
          recipientUserIds: ['u1'],
        },
      ],
      DELIVERY_AT_RISK_DEFAULTS,
    );
    expect(hits).toHaveLength(0);
  });

  it('does not fire when either date is missing', () => {
    const promised = new Date('2026-06-25T12:00:00Z');
    const hits = detectDeliveryAtRisk(
      [
        {
          caseId: 'c1',
          caseNumber: '2026-0001',
          workshopId: 'w1',
          promisedAt: promised,
          forecastAt: null,
          recipientUserIds: ['u1'],
        },
        {
          caseId: 'c2',
          caseNumber: '2026-0002',
          workshopId: 'w1',
          promisedAt: null,
          forecastAt: promised,
          recipientUserIds: ['u1'],
        },
      ],
      DELIVERY_AT_RISK_DEFAULTS,
    );
    expect(hits).toHaveLength(0);
  });

  it('respects custom min slip parameter', () => {
    const promised = new Date('2026-06-25T12:00:00Z');
    const forecast = new Date('2026-06-26T00:00:00Z'); // +12h
    const hits = detectDeliveryAtRisk(
      [
        {
          caseId: 'c1',
          caseNumber: '2026-0001',
          workshopId: 'w1',
          promisedAt: promised,
          forecastAt: forecast,
          recipientUserIds: ['u1'],
        },
      ],
      { minSlipHours: 6 },
    );
    expect(hits).toHaveLength(1);
  });
});
