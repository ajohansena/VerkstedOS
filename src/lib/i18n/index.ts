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

/**
 * Canonical locale-aware formatters (Batch 5 — UI polish).
 *
 * Why centralised: Norwegian Bokmål users expect `12.06.2026` and
 * `12.06.2026, 14:30`, not the US default. Every previous call site used
 * `toLocaleDateString()` / `toLocaleString()` with no locale arg, which falls
 * through to whatever the Node/runtime picks (usually `en-US`). These helpers
 * route every display through the active org locale and give us one place to
 * change formatting later (e.g. for `nn-NO`).
 *
 * Inputs accept Date | string | number (ISO strings round-trip through `new
 * Date()` without `Z` ambiguity for our schemas — all timestamps are
 * `with timezone`).
 */
type DateLike = Date | string | number;

function toDate(value: DateLike): Date {
  return value instanceof Date ? value : new Date(value);
}

/** `12.06.2026` (nb-NO) / `6/12/2026` (en). */
export function formatDate(
  value: DateLike,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** `12.06.2026, 14:30` (nb-NO) / `6/12/2026, 2:30 PM` (en). */
export function formatDateTime(
  value: DateLike,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Locale-aware number with grouping (`1 234,56` nb-NO / `1,234.56` en). */
export function formatNumber(
  value: number,
  locale: Locale = DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale, options).format(value);
}

/** Money formatter — defaults to NOK because that is the production currency. */
export function formatMoney(
  value: number,
  locale: Locale = DEFAULT_LOCALE,
  currency = 'NOK',
): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale } from './config';
export type { Locale } from './config';
export type { Messages } from './messages/nb';
