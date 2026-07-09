export const LOCALES = ["en", "zh-CN"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that persists the user's locale choice across sessions and SSR. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** One year, in seconds. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Human-readable labels for the language switcher, shown in each locale's own script. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}
