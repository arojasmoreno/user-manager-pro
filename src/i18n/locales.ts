/**
 * Locales supported by the app.
 *
 * `code` is what gets stored in `fichaTranslations.locale` and sent to the
 * translation model. `dir` drives the document direction, so Moroccan Arabic
 * renders right-to-left everywhere.
 */
export const LOCALES = [
  {
    code: "es-ES",
    country: "ES",
    name: "Español (España)",
    short: "Español",
    dir: "ltr",
  },
  {
    code: "fr-FR",
    country: "FR",
    name: "Français (France)",
    short: "Français",
    dir: "ltr",
  },
  {
    code: "en-GB",
    country: "GB",
    name: "English (United Kingdom)",
    short: "English",
    dir: "ltr",
  },
  {
    code: "ar-MA",
    country: "MA",
    name: "العربية (المغرب)",
    short: "العربية",
    dir: "rtl",
  },
  {
    code: "mnk",
    country: "GM",
    name: "Mandinka",
    short: "Mandinka",
    dir: "ltr",
  },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export type LocaleMeta = (typeof LOCALES)[number];
export type TextDirection = "ltr" | "rtl";

export const DEFAULT_LOCALE: Locale = "es-ES";

export const LOCALE_CODES = LOCALES.map((l) => l.code);

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALE_CODES as string[]).includes(value);
}

export function getLocale(code: Locale): LocaleMeta {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

/** The locale the fichas are authored in; they never need a translation. */
export const SOURCE_LOCALE: Locale = DEFAULT_LOCALE;
