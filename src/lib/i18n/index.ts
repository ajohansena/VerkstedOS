import { DEFAULT_LOCALE, isLocale, type Locale } from './config';
import { en } from './messages/en';
import { nb, type Messages } from './messages/nb';

/**
 * i18n entry point. The dictionary is resolved per request from the active
 * locale (default nb-NO). Server components do:
 *
 *   const dict = await getDictionary(await resolveLocale(orgSettings));
 *   <h1>{dict.case.photos}</h1>
 *
 * `format` does simple `{name}` interpolation — no heavy i18n library (the
 * No-Cleverness rule); pluralization can be added when a real case needs it.
 */

const DICTIONARIES: Record<Locale, Messages> = {
  'nb-NO': nb,
  en,
};

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Messages {
  return DICTIONARIES[locale];
}

/**
 * Resolve the active locale from an org's settings bag, falling back to the
 * default (nb-NO). Accepts the raw `organizations.settings` JSON.
 */
export function resolveLocale(orgSettings?: unknown): Locale {
  if (orgSettings && typeof orgSettings === 'object') {
    const candidate = (orgSettings as Record<string, unknown>)['locale'];
    if (isLocale(candidate)) return candidate;
  }
  return DEFAULT_LOCALE;
}

/** Replace `{key}` placeholders in a template with values from `params`. */
export function format(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale } from './config';
export type { Locale } from './config';
export type { Messages } from './messages/nb';
