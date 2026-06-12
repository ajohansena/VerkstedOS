import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  format,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  getDictionary,
  resolveLocale,
} from './index';

describe('i18n', () => {
  it('defaults to Norwegian Bokmål', () => {
    expect(DEFAULT_LOCALE).toBe('nb-NO');
    expect(getDictionary().nav.cases).toBe('Saker');
  });

  it('returns the English catalog when explicitly requested', () => {
    expect(getDictionary('en').nav.cases).toBe('Cases');
  });

  it('resolves locale from org settings, falling back to the default', () => {
    expect(resolveLocale({ locale: 'en' })).toBe('en');
    expect(resolveLocale({ locale: 'nb-NO' })).toBe('nb-NO');
    expect(resolveLocale({ locale: 'fr' })).toBe('nb-NO'); // unsupported
    expect(resolveLocale(undefined)).toBe('nb-NO');
    expect(resolveLocale({})).toBe('nb-NO');
  });

  it('interpolates {name} placeholders', () => {
    expect(format('Hei, {email}.', { email: 'a@b.no' })).toBe('Hei, a@b.no.');
    // Unknown placeholders are left untouched.
    expect(format('{a} {b}', { a: '1' })).toBe('1 {b}');
  });

  describe('formatDate / formatDateTime', () => {
    // Pick noon UTC to dodge tz drift around midnight in the CI box.
    const sample = new Date('2026-06-12T12:00:00Z');

    it('uses nb-NO dd.MM.yyyy by default', () => {
      expect(formatDate(sample)).toBe('12.06.2026');
    });

    it('accepts ISO strings and numbers', () => {
      expect(formatDate('2026-06-12T12:00:00Z')).toBe('12.06.2026');
      expect(formatDate(sample.getTime())).toBe('12.06.2026');
    });

    it('returns em-dash for invalid input', () => {
      expect(formatDate('not-a-date')).toBe('—');
      expect(formatDateTime(Number.NaN as unknown as number)).toBe('—');
    });

    it('honours an explicit locale', () => {
      expect(formatDate(sample, 'en')).toMatch(/06\/12\/2026|6\/12\/2026/);
    });

    it('formatDateTime includes hour and minute', () => {
      const out = formatDateTime(sample);
      // Match `12.06.2026, HH:MM` allowing for the runtime TZ.
      expect(out).toMatch(/^12\.06\.2026,?\s\d{2}:\d{2}$/);
    });
  });

  describe('formatNumber / formatMoney', () => {
    it('formats numbers with nb-NO grouping', () => {
      // nb-NO uses non-breaking space (U+00A0) as the thousands separator.
      expect(formatNumber(1234.5)).toMatch(/1\u00a0234,5/);
    });

    it('formats money as NOK by default', () => {
      const out = formatMoney(1234);
      expect(out).toMatch(/1\u00a0234/);
      expect(out).toMatch(/kr/);
    });

    it('returns em-dash for non-finite numbers', () => {
      expect(formatNumber(Number.NaN)).toBe('—');
      expect(formatMoney(Number.POSITIVE_INFINITY)).toBe('—');
    });
  });
});
