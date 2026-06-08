/**
 * i18n configuration (docs/02-system-architecture.md § Localization:
 * "Norwegian primary, English secondary; i18n from day one").
 *
 * The primary application language is Norwegian Bokmål (nb-NO). User-facing
 * labels, navigation, buttons, validation messages and workflows are Norwegian
 * by default. Database schema, code, APIs and technical internals remain
 * English. A future per-org `settings.locale` may override the default.
 */

export const SUPPORTED_LOCALES = ['nb-NO', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** The default user-facing language. */
export const DEFAULT_LOCALE: Locale = 'nb-NO';

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}
