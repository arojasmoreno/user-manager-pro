import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAdmin, requireUser } from "./access";
import { ROLES, localeValidator } from "./schema";
import { LOCALES } from "../i18n/locales";
import type { Id } from "./_generated/dataModel";

/** The locale fichas are authored in, so it never needs a translation row. */
export const SOURCE_LOCALE = "es-ES";

/** Ids of the active fichas the caller is allowed to see. */
async function visibleFichaIds(
  ctx: QueryCtx,
  role: string | undefined,
  myCenters: Id<"workCenters">[],
): Promise<Set<Id<"fichas">>> {
  const fichas = await ctx.db.query("fichas").collect();
  const isAdmin = role === ROLES.ADMIN;
  return new Set(
    fichas
      .filter((f) => f.active)
      .filter((f) =>
        isAdmin ? true : f.workCenterIds.some((c) => myCenters.includes(c)),
      )
      .map((f) => f._id),
  );
}

/**
 * Translations for one locale, restricted to the fichas the caller can see.
 *
 * Kept as a separate query (instead of folding it into `fichas.listMine`) so
 * the catalog query and its tests stay untouched, and so the translations can
 * be refetched on their own when the language changes.
 */
export const listTranslations = query({
  args: { locale: v.string() },
  returns: v.array(
    v.object({
      fichaId: v.id("fichas"),
      locale: localeValidator,
      title: v.string(),
      productName: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
      source: v.union(v.literal("ai"), v.literal("manual")),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!isLocaleCode(args.locale) || args.locale === SOURCE_LOCALE) return [];

    const visible = await visibleFichaIds(
      ctx,
      user.role,
      user.workCenterIds ?? [],
    );
    const rows = await ctx.db
      .query("fichaTranslations")
      .filter((q) => q.eq(q.field("locale"), args.locale))
      .collect();

    return rows
      .filter((r) => visible.has(r.fichaId))
      .map((r) => ({
        fichaId: r.fichaId,
        locale: r.locale,
        title: r.title,
        productName: r.productName,
        manufacturer: r.manufacturer,
        source: r.source,
      }));
  },
});

/** Every stored translation of one ficha, for the admin editor. */
export const listByFicha = query({
  args: { fichaId: v.id("fichas") },
  returns: v.array(
    v.object({
      locale: localeValidator,
      title: v.string(),
      productName: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
      source: v.union(v.literal("ai"), v.literal("manual")),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("fichaTranslations")
      .filter((q) => q.eq(q.field("fichaId"), args.fichaId))
      .collect();
    return rows.map((r) => ({
      locale: r.locale,
      title: r.title,
      productName: r.productName,
      manufacturer: r.manufacturer,
      source: r.source,
    }));
  },
});

/** Locales a ficha still needs, given what is already stored. */
export const missingLocales = query({
  args: { fichaId: v.id("fichas") },
  returns: v.array(localeValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("fichaTranslations")
      .filter((q) => q.eq(q.field("fichaId"), args.fichaId))
      .collect();
    const done = new Set(rows.map((r) => r.locale));
    return LOCALES.map((l) => l.code).filter(
      (code) => code !== SOURCE_LOCALE && !done.has(code),
    );
  },
});

type UpsertArgs = {
  fichaId: Id<"fichas">;
  locale: "es-ES" | "fr-FR" | "en-GB" | "ar-MA" | "mnk";
  title: string;
  productName?: string;
  manufacturer?: string;
  source: "ai" | "manual";
};

/** Create or replace the translation of one ficha in one locale. */
async function upsertTranslation(
  ctx: MutationCtx,
  args: UpsertArgs,
): Promise<null> {
  const title = args.title.trim();
  if (title === "") {
    throw new Error("El título traducido no puede estar vacío.");
  }
  const existing = await ctx.db
    .query("fichaTranslations")
    .filter((q) => q.eq(q.field("fichaId"), args.fichaId))
    .filter((q) => q.eq(q.field("locale"), args.locale))
    .first();

  const fields = {
    title,
    productName: args.productName?.trim() || undefined,
    manufacturer: args.manufacturer?.trim() || undefined,
    source: args.source,
  };

  if (existing !== null) {
    await ctx.db.patch(existing._id, fields);
    return null;
  }
  await ctx.db.insert("fichaTranslations", {
    fichaId: args.fichaId,
    locale: args.locale,
    ...fields,
  });
  return null;
}

/** Used by the AI action, which can only reach internal functions. */
export const upsert = internalMutation({
  args: {
    fichaId: v.id("fichas"),
    locale: localeValidator,
    title: v.string(),
    productName: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    source: v.union(v.literal("ai"), v.literal("manual")),
  },
  returns: v.null(),
  handler: async (ctx, args) => await upsertTranslation(ctx, args),
});

/** Administrator writes or corrects a translation by hand. */
export const saveTranslation = mutation({
  args: {
    fichaId: v.id("fichas"),
    locale: localeValidator,
    title: v.string(),
    productName: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await upsertTranslation(ctx, { ...args, source: "manual" });
  },
});

function isLocaleCode(value: string): value is UpsertArgs["locale"] {
  return (LOCALES as readonly { code: string }[]).some(
    (l) => l.code === value,
  );
}
