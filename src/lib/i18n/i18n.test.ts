import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, format, getDictionary, resolveLocale } from './index';

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
});
