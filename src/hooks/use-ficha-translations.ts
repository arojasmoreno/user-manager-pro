import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { SOURCE_LOCALE } from "@/i18n/locales";
import { TRANSLATIONS_ENABLED } from "@/lib/features";
import { useSafeQuery } from "@/hooks/use-safe-query";

export type FichaFields = {
  _id: string;
  title: string;
  productName?: string;
  manufacturer?: string;
};

export type TranslatedFields = {
  title: string;
  productName?: string;
  manufacturer?: string;
  /** True when the ficha had to fall back to the original language. */
  isFallback: boolean;
};

/**
 * Translations of the catalog for the active language, merged over the original
 * ficha fields.
 *
 * Returns a lookup function instead of new arrays so a translated ficha and an
 * untranslated one are rendered by exactly the same code path.
 */
export function useFichaTranslations() {
  const { locale } = useI18n();
  // Con las traducciones apagadas (ver `features.ts`) o en el idioma de origen
  // no hay nada que traer: se salta la suscripción para no pedir una lista
  // vacía en cada carga del catálogo.
  const active = TRANSLATIONS_ENABLED && locale !== SOURCE_LOCALE;

  const { data } = useSafeQuery(
    api.traducciones.listTranslations,
    active ? { locale } : "skip",
  );

  const byFicha = new Map<string, TranslatedFields>();
  for (const row of data ?? []) {
    byFicha.set(row.fichaId, {
      title: row.title,
      productName: row.productName,
      manufacturer: row.manufacturer,
      isFallback: false,
    });
  }

  return (ficha: FichaFields): TranslatedFields => {
    // Con el interruptor apagado se ignoran hasta las traducciones ya
    // guardadas: el catálogo se ve íntegramente en su idioma original.
    const hit = active ? byFicha.get(ficha._id) : undefined;
    if (hit) return hit;
    return {
      title: ficha.title,
      productName: ficha.productName,
      manufacturer: ficha.manufacturer,
      isFallback: active,
    };
  };
}
