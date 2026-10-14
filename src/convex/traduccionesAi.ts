"use node";

import { v, ConvexError } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getLocale, isLocale } from "../i18n/locales";
import { translateFields, userFacingAiError } from "./aiClient";
import { SOURCE_LOCALE } from "./traducciones";

/**
 * Translate one ficha's fields into one locale with the AI and store the
 * result. Administrator only. Fails with the AI's own error when the key is
 * not configured, so the UI can tell the admin what is missing.
 *
 * It lives in its own `"use node"` module because Node modules may only
 * define actions.
 */
/** Campos traducibles de una ficha, tal y como los devuelve la IA. */
type TranslatedFields = {
  title: string;
  productName?: string;
  manufacturer?: string;
};

export const translateFicha = action({
  args: { fichaId: v.id("fichas"), locale: v.string() },
  returns: v.object({
    title: v.string(),
    productName: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
  }),
  // El tipo de retorno se escribe a mano: si se deja inferir, la acción pasa a
  // depender del tipo del objeto `internal` —que la incluye a ella— y TypeScript
  // la marca como autorreferente y la degrada a `any`.
  handler: async (ctx, args): Promise<TranslatedFields> => {
    // An action has no direct db access, so permissions are checked by
    // running the query that already enforces them.
    await ctx.runQuery(internal.access.requireAdminInternal, {});
    // Los `ConvexError` son los únicos cuyo mensaje llega intacto al navegador;
    // con un `Error` normal, el administrador solo vería «Server Error Called by
    // client» y no sabría qué corregir.
    if (!isLocale(args.locale)) {
      throw new ConvexError("Idioma no admitido.");
    }
    if (args.locale === SOURCE_LOCALE) {
      throw new ConvexError("Las fichas ya están escritas en este idioma.");
    }

    const ficha = await ctx.runQuery(internal.fichas.getForTranslation, {
      fichaId: args.fichaId,
    });
    if (ficha === null) {
      throw new ConvexError("Ficha no encontrada.");
    }

    const translated = await translateFields({
      fields: {
        title: ficha.title,
        productName: ficha.productName,
        manufacturer: ficha.manufacturer,
      },
      targetLocale: args.locale,
      targetName: getLocale(args.locale).name,
    }).catch((err: unknown) => {
      throw userFacingAiError(err);
    });

    await ctx.runMutation(internal.traducciones.upsert, {
      fichaId: args.fichaId,
      locale: args.locale,
      title: translated.title,
      productName: translated.productName,
      manufacturer: translated.manufacturer,
      source: "ai",
    });

    return translated;
  },
});
