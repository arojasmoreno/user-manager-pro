import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { ROLES } from "./schema";
import { requireAdmin, requireUser } from "./access";
import {
  assertVisibleFichaType,
  fichaKindValidator,
} from "./fichaTypes";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Fichas visible to the current user:
// - admins see everything
// - regular users see fichas whose centers intersect their assignments
export const listMine = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("fichas"),
      _creationTime: v.number(),
      title: v.string(),
      kind: fichaKindValidator,
      productName: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
      url: v.string(),
      workCenterIds: v.array(v.id("workCenters")),
      active: v.boolean(),
      contentText: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const isAdmin = user.role === ROLES.ADMIN;
    const mine = user.workCenterIds ?? [];
    // Sólo las activas: se filtra por el índice en lugar de leer toda la tabla.
    const active = await ctx.db
      .query("fichas")
      .withIndex("active", (q) => q.eq("active", true))
      .collect();
    return active
      .filter((f) => (f.workCenterIds ?? []).length > 0)
      .filter((f) => {
        const centers = f.workCenterIds ?? [];
        return isAdmin || centers.some((c) => mine.includes(c));
      })
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((f) => ({
        _id: f._id,
        _creationTime: f._creationTime,
        title: f.title,
        kind: f.kind,
        productName: f.productName,
        manufacturer: f.manufacturer,
        url: f.url,
        workCenterIds: f.workCenterIds,
        active: f.active,
        contentText: f.contentText,
      }));
  },
});

// Admin-only: list every ficha including inactive ones
export const listAll = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("fichas"),
      _creationTime: v.number(),
      title: v.string(),
      kind: fichaKindValidator,
      productName: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
      url: v.string(),
      workCenterIds: v.array(v.id("workCenters")),
      active: v.boolean(),
      contentText: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("fichas").collect();
    return all
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((f) => ({
        _id: f._id,
        _creationTime: f._creationTime,
        title: f.title,
        kind: f.kind,
        productName: f.productName,
        manufacturer: f.manufacturer,
        url: f.url,
        workCenterIds: f.workCenterIds,
        active: f.active,
        contentText: f.contentText,
      }));
  },
});

/**
 * Raw ficha for server-side use (e.g. the AI translation action). Not callable
 * from the browser: it skips the per-user visibility check on purpose, so the
 * action that uses it must enforce its own permissions first.
 */
export const getForTranslation = internalQuery({
  args: { fichaId: v.id("fichas") },
  returns: v.union(
    v.object({
      _id: v.id("fichas"),
      title: v.string(),
      kind: fichaKindValidator,
      productName: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const ficha = await ctx.db.get(args.fichaId);
    if (ficha === null) return null;
    return {
      _id: ficha._id,
      title: ficha.title,
      kind: ficha.kind,
      productName: ficha.productName,
      manufacturer: ficha.manufacturer,
    };
  },
});

// A single ficha, only if the caller may see it
export const getById = query({
  args: { fichaId: v.id("fichas") },
  returns: v.union(
    v.object({
      _id: v.id("fichas"),
      title: v.string(),
      kind: fichaKindValidator,
      productName: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
      url: v.string(),
      workCenterIds: v.array(v.id("workCenters")),
      active: v.boolean(),
      contentText: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ficha = await ctx.db.get(args.fichaId);
    if (ficha === null) return null;
    const isAdmin = user.role === ROLES.ADMIN;
    const mine = user.workCenterIds ?? [];
    const centers = ficha.workCenterIds ?? [];
    const allowed =
      isAdmin || (ficha.active && centers.some((c) => mine.includes(c)));
    if (!allowed) return null;
    return {
      _id: ficha._id,
      title: ficha.title,
      kind: ficha.kind,
      productName: ficha.productName,
      manufacturer: ficha.manufacturer,
      url: ficha.url,
      workCenterIds: centers,
      active: ficha.active,
      contentText: ficha.contentText,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations (admin)
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    title: v.string(),
    kind: fichaKindValidator,
    productName: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    url: v.string(),
    workCenterIds: v.array(v.id("workCenters")),
    contentText: v.optional(v.string()),
  },
  returns: v.id("fichas"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // El tipo lo elige el administrador, así que se comprueba contra la lista
    // vigente en lugar de contra una unión fija en el esquema.
    await assertVisibleFichaType(ctx, args.kind);
    const url = args.url.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      throw new Error("La URL debe empezar por http:// o https://");
    }
    return await ctx.db.insert("fichas", {
      title: args.title.trim(),
      kind: args.kind,
      ...(args.productName?.trim()
        ? { productName: args.productName.trim() }
        : null),
      ...(args.manufacturer?.trim()
        ? { manufacturer: args.manufacturer.trim() }
        : null),
      url,
      workCenterIds: args.workCenterIds,
      active: args.workCenterIds.length > 0,
      ...(args.contentText?.trim()
        ? { contentText: args.contentText.trim() }
        : null),
    });
  },
});

export const update = mutation({
  args: {
    fichaId: v.id("fichas"),
    title: v.optional(v.string()),
    kind: v.optional(fichaKindValidator),
    productName: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    url: v.optional(v.string()),
    workCenterIds: v.optional(v.array(v.id("workCenters"))),
    active: v.optional(v.boolean()),
    contentText: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const ficha = await ctx.db.get(args.fichaId);
    if (ficha === null) throw new Error("Ficha no encontrada.");

    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.kind !== undefined) {
      await assertVisibleFichaType(ctx, args.kind);
      patch.kind = args.kind;
    }
    if (args.productName !== undefined) {
      patch.productName = args.productName.trim() || undefined;
    }
    if (args.manufacturer !== undefined) {
      patch.manufacturer = args.manufacturer.trim() || undefined;
    }
    if (args.contentText !== undefined) {
      patch.contentText = args.contentText.trim() || undefined;
    }
    if (args.url !== undefined) {
      const url = args.url.trim();
      if (!/^https?:\/\/.+/i.test(url)) {
        throw new Error("La URL debe empezar por http:// o https://");
      }
      // Al sustituir el documento se conserva el anterior en el histórico, para
      // poder consultar revisiones previas sin perderlas.
      if (url !== ficha.url) {
        await ctx.db.insert("fichaVersions", {
          fichaId: args.fichaId,
          url: ficha.url,
          title: ficha.title,
          productName: ficha.productName,
          manufacturer: ficha.manufacturer,
          at: Date.now(),
        });
      }
      patch.url = url;
    }
    if (args.workCenterIds !== undefined) {
      patch.workCenterIds = args.workCenterIds;
      patch.active = args.workCenterIds.length > 0;
    }
    if (args.active !== undefined) patch.active = args.active;

    await ctx.db.patch(args.fichaId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { fichaId: v.id("fichas") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.fichaId);
    // Las traducciones y el histórico de versiones de la ficha se van con ella:
    // sin esto quedarían filas huérfanas invisibles desde la interfaz.
    const translations = await ctx.db
      .query("fichaTranslations")
      .withIndex("byFicha", (q) => q.eq("fichaId", args.fichaId))
      .collect();
    for (const row of translations) {
      await ctx.db.delete(row._id);
    }
    const versions = await ctx.db
      .query("fichaVersions")
      .withIndex("byFicha", (q) => q.eq("fichaId", args.fichaId))
      .collect();
    for (const row of versions) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// Uso del catálogo
// ---------------------------------------------------------------------------

/**
 * Registra que alguien ha abierto el documento de una ficha.
 *
 * Se llama desde el visor al mostrarse. No exige admin: cualquier usuario que
 * pueda ver la ficha la cuenta. Es una escritura de contador, barata y
 * desechable si falla (el visor no depende de ella).
 */
export const registerOpen = mutation({
  args: { fichaId: v.id("fichas") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ficha = await ctx.db.get(args.fichaId);
    if (ficha === null) return null;
    const isAdmin = user.role === ROLES.ADMIN;
    const mine = user.workCenterIds ?? [];
    const centers = ficha.workCenterIds ?? [];
    if (!(isAdmin || (ficha.active && centers.some((c) => mine.includes(c))))) {
      return null;
    }
    await ctx.db.patch(args.fichaId, {
      openCount: (ficha.openCount ?? 0) + 1,
      lastOpenedAt: Date.now(),
    });
    return null;
  },
});

/** Versiones anteriores del documento de una ficha, más reciente primero. */
export const listVersions = query({
  args: { fichaId: v.id("fichas") },
  returns: v.array(
    v.object({
      _id: v.id("fichaVersions"),
      url: v.string(),
      title: v.string(),
      at: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("fichaVersions")
      .withIndex("byFicha", (q) => q.eq("fichaId", args.fichaId))
      .collect();
    return rows
      .sort((a, b) => b.at - a.at)
      .map((r) => ({ _id: r._id, url: r.url, title: r.title, at: r.at }));
  },
});

/**
 * Informe de uso del catálogo (sólo administrador): fichas más abiertas y
 * cuántas no se han abierto nunca. Ayuda a detectar documentos inútiles y
 * pedidos frecuentes.
 */
export const usageStats = query({
  args: {},
  returns: v.object({
    mostOpened: v.array(
      v.object({
        _id: v.id("fichas"),
        title: v.string(),
        openCount: v.number(),
        lastOpenedAt: v.optional(v.number()),
      }),
    ),
    neverOpened: v.array(
      v.object({ _id: v.id("fichas"), title: v.string() }),
    ),
    totalOpens: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("fichas").collect();
    const withOpens = all
      .filter((f) => (f.openCount ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.openCount ?? 0) - (a.openCount ?? 0) ||
          a.title.localeCompare(b.title),
      )
      .slice(0, 10)
      .map((f) => ({
        _id: f._id,
        title: f.title,
        openCount: f.openCount ?? 0,
        lastOpenedAt: f.lastOpenedAt,
      }));
    const neverOpened = all
      .filter((f) => (f.openCount ?? 0) === 0)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((f) => ({ _id: f._id, title: f.title }));
    const totalOpens = all.reduce((sum, f) => sum + (f.openCount ?? 0), 0);
    return { mostOpened: withOpens, neverOpened, totalOpens };
  },
});
