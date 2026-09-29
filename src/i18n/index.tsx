import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  getLocale,
  isLocale,
  type Locale,
  type TextDirection,
} from "./locales";
import { en } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";
import { ar } from "./dictionaries/ar";
import { mnk } from "./dictionaries/mnk";

const STORAGE_KEY = "doc-manager-locale";

/**
 * The key of every entry is the Spanish source string, so a missing
 * translation degrades to readable Spanish instead of a missing-key stub.
 */
const DICTIONARIES: Record<Locale, Record<string, string>> = {
  "es-ES": {},
  "fr-FR": fr,
  "en-GB": en,
  "ar-MA": ar,
  mnk,
};

function detectLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Private mode or blocked storage: fall through to the browser languages.
  }
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const raw of candidates) {
    if (isLocale(raw)) return raw;
    const lower = raw.toLowerCase();
    if (lower.startsWith("es")) return "es-ES";
    if (lower.startsWith("fr")) return "fr-FR";
    if (lower.startsWith("en")) return "en-GB";
    if (lower.startsWith("ar")) return "ar-MA";
    if (lower.startsWith("mnk")) return "mnk";
  }
  return DEFAULT_LOCALE;
}

export type TranslateVars = Record<string, string | number>;

type I18nValue = {
  locale: Locale;
  dir: TextDirection;
  setLocale: (locale: Locale) => void;
  /** Translate a Spanish source string, interpolating `{placeholders}`. */
  t: (key: string, vars?: TranslateVars) => string;
};

const NOOP_SET_LOCALE = () => {};

/**
 * Used when a component renders outside the provider — for example inside an
 * error boundary, which mounts above it. Falling back to Spanish keeps the
 * error screen readable instead of crashing while it reports an error.
 */
const FALLBACK: I18nValue = {
  locale: DEFAULT_LOCALE,
  dir: "ltr",
  setLocale: NOOP_SET_LOCALE,
  t: (key) => key,
};

const I18nContext = createContext<I18nValue>(FALLBACK);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const dir = getLocale(locale).dir;

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dir;
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persisting is best effort; the choice still applies for this session.
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTIONARIES[locale];
    return {
      locale,
      dir,
      setLocale,
      t: (key, vars) => {
        const template = dict[key] ?? key;
        if (!vars) return template;
        return template.replace(/\{(\w+)\}/g, (match, name: string) =>
          name in vars ? String(vars[name]) : match,
        );
      },
    };
  }, [locale, dir, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
