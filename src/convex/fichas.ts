import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ROLES } from "./schema";
import { requireAdmin, requireUser } from "./access";

export const fichaKindValidator = v.union(
  v.literal("ficha_tecnica"),
  v.literal("ficha_seguridad"),
  v.literal("manual_instrucciones"),
  v.literal("instrucciones_trabajo"),
);

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
      title: v.string(),
      kind: fichaKindValidator,
      productName: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
      url: v.string(),
      workCenterIds: v.array(v.id("workCenters")),
      active: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const isAdmin = user.role === ROLES.ADMIN;
    const mine = user.workCenterIds ?? [];
    const all = await ctx.db.query("fichas").collect();
    return all
      .filter((f) => f.active && (f.workCenterIds ?? []).length > 0)
      .filter((f) => {
        const centers = f.workCenterIds ?? [];
        return isAdmin || centers.some((c) => mine.includes(c));
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  },
});

// Admin-only: list every ficha including inactive ones
export const listAll = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("fichas"),
      title: v.string(),
      kind: fichaKindValidator,
      productName: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
      url: v.string(),
      workCenterIds: v.array(v.id("workCenters")),
      active: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("fichas").collect();
    return all.sort((a, b) => a.title.localeCompare(b.title));
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
  },
  returns: v.id("fichas"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const ficha = await ctx.db.get(args.fichaId);
    if (ficha === null) throw new Error("Ficha no encontrada.");

    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.kind !== undefined) patch.kind = args.kind;
    if (args.productName !== undefined) {
      patch.productName = args.productName.trim() || undefined;
    }
    if (args.manufacturer !== undefined) {
      patch.manufacturer = args.manufacturer.trim() || undefined;
    }
    if (args.url !== undefined) {
      const url = args.url.trim();
      if (!/^https?:\/\/.+/i.test(url)) {
        throw new Error("La URL debe empezar por http:// o https://");
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
    return null;
  },
});
