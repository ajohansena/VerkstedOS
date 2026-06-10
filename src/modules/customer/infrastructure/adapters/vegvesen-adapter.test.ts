import { describe, expect, it } from 'vitest';

import { parseVegvesenPayload } from '@/modules/customer/infrastructure/adapters/vegvesen-adapter';

/**
 * Unit tests for the Vegvesen payload parser (D1 — Intake Wizard).
 *
 * The Akfell `kjoretoydata` endpoint returns a deeply nested payload that
 * varies by vehicle category and registration history. The parser must:
 *
 *   - tolerate missing/optional fields
 *   - extract make / model / year / colour / VIN when present
 *   - never throw on malformed input — always return a structured fallback
 *
 * Pure function, no I/O — fast unit test (Vitest, no Postgres).
 */
describe('parseVegvesenPayload', () => {
  it('extracts make, model, year, colour, vin from a typical payload', () => {
    const raw = {
      kjoretoydataListe: [
        {
          kjoretoyId: {
            kjennemerke: 'DL12345',
            understellsnummer: 'JTDBT923201234567',
          },
          forstegangsregistrering: {
            registrertForstegangNorgeDato: '2018-03-15',
          },
          godkjenning: {
            tekniskGodkjenning: {
              tekniskeData: {
                generelt: {
                  merke: [{ merke: 'TOYOTA' }],
                  handelsbetegnelse: ['YARIS'],
                },
                karosseriOgLasteplan: {
                  rFarge: [{ kodeNavn: 'HVIT' }],
                },
              },
            },
          },
        },
      ],
    };
    const r = parseVegvesenPayload('DL12345', raw);
    expect(r.found).toBe(true);
    expect(r.registrationNumber).toBe('DL12345');
    expect(r.make).toBe('TOYOTA');
    expect(r.model).toBe('YARIS');
    expect(r.year).toBe(2018);
    expect(r.colour).toBe('hvit');
    expect(r.vin).toBe('JTDBT923201234567');
  });

  it('handles missing optional fields gracefully', () => {
    const raw = {
      kjoretoydataListe: [
        {
          kjoretoyId: { kjennemerke: 'AB99999' },
          // no godkjenning, no forstegangsregistrering
        },
      ],
    };
    const r = parseVegvesenPayload('AB99999', raw);
    expect(r.found).toBe(true);
    expect(r.make).toBeUndefined();
    expect(r.model).toBeUndefined();
    expect(r.year).toBeUndefined();
    expect(r.colour).toBeUndefined();
    expect(r.vin).toBeUndefined();
  });

  it('returns not-found for null/undefined/non-object input', () => {
    expect(parseVegvesenPayload('XX1', null).found).toBe(false);
    expect(parseVegvesenPayload('XX1', undefined).found).toBe(false);
    expect(parseVegvesenPayload('XX1', 'not json').found).toBe(false);
    expect(parseVegvesenPayload('XX1', 42).found).toBe(false);
  });

  it('returns not-found when kjoretoydataListe is empty', () => {
    const r = parseVegvesenPayload('XX1', { kjoretoydataListe: [] });
    expect(r.found).toBe(false);
  });

  it('falls back to top-level entry when there is no kjoretoydataListe wrapper', () => {
    const raw = {
      kjoretoyId: { kjennemerke: 'CC22222' },
      godkjenning: {
        tekniskGodkjenning: {
          tekniskeData: {
            generelt: { merke: [{ merke: 'FORD' }] },
          },
        },
      },
    };
    const r = parseVegvesenPayload('CC22222', raw);
    expect(r.found).toBe(true);
    expect(r.make).toBe('FORD');
  });

  it('rejects an obviously bad year (outside 1900..2099)', () => {
    const raw = {
      kjoretoydataListe: [
        {
          kjoretoyId: { kjennemerke: 'YY1' },
          forstegangsregistrering: {
            registrertForstegangNorgeDato: '0001-01-01',
          },
        },
      ],
    };
    const r = parseVegvesenPayload('YY1', raw);
    expect(r.year).toBeUndefined();
  });
});
