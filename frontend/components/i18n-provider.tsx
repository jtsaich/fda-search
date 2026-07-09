"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "@/lib/i18n/config";
import { dictionaries, type TranslationKey } from "@/lib/i18n/dictionaries";

type TranslateVars = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** Translate a known key, substituting `{var}` placeholders from `vars`. */
  t: (key: TranslationKey, vars?: TranslateVars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      document.documentElement.lang = next;
      // Re-render Server Components so any server-read locale stays in sync.
      router.refresh();
    },
    [router]
  );

  const t = useCallback(
    (key: TranslationKey, vars?: TranslateVars) => {
      const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
      let value = dict[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.split(`{${name}}`).join(String(replacement));
        }
      }
      return value;
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
