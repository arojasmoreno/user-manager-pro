"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getLocale, isLocale } from "../i18n/locales";
import { translateFields } from "./gemini";
import { SOURCE_LOCALE } from "./traducciones";

/**
 * Translate one ficha's fields into one locale with the AI and store the
 * result. Administrator only. Fails with the AI's own error when the key is
 * not configured, so the UI can tell the admin what is missing.
 *
 * It lives in its own `"use node"` module because Node modules may only
 * define actions.
 */
export const translateFicha = action({
  args: { fichaId: v.id("fichas"), locale: v.string() },
  returns: v.object({
    title: v.string(),
    productName: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // An action has no direct db access, so permissions are checked by
    // running the query that already enforces them.
    await ctx.runQuery(internal.access.requireAdminInternal, {});
    if (!isLocale(args.locale)) {
      throw new Error("Idioma no admitido.");
    }
    if (args.locale === SOURCE_LOCALE) {
      throw new Error("Las fichas ya están escritas en este idioma.");
    }

    const ficha = await ctx.runQuery(internal.fichas.getForTranslation, {
      fichaId: args.fichaId,
    });
    if (ficha === null) {
      throw new Error("Ficha no encontrada.");
    }

    const translated = await translateFields({
      fields: {
        title: ficha.title,
        productName: ficha.productName,
        manufacturer: ficha.manufacturer,
      },
      targetLocale: args.locale,
      targetName: getLocale(args.locale).name,
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
