import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./access";
import {
  assertVisibleFichaType,
  fichaKindValidator,
} from "./fichaTypes";
import { mergeFichaTypes, sameFichaTypeName } from "../lib/fichaTypes";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Fichas — administración completa
// ---------------------------------------------------------------------------

export const createFichaAdmin = mutation({
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
    await assertVisibleFichaType(ctx, args.kind);
    const url = args.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("La URL debe empezar por http:// o https://");
    }
    return await ctx.db.insert("fichas", {
      title: args.title.trim(),
      kind: args.kind,
      productName: args.productName?.trim() || undefined,
      manufacturer: args.manufacturer?.trim() || undefined,
      url,
      workCenterIds: args.workCenterIds,
      active: args.workCenterIds.length > 0,
    });
  },
});

export const updateFichaAdmin = mutation({
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
    if (ficha === null) {
      throw new Error("Ficha no encontrada.");
    }

    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (title === "") {
        throw new Error("El título no puede estar vacío.");
      }
      patch.title = title;
    }
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
    if (args.url !== undefined) {
      const url = args.url.trim();
      if (!/^https?:\/\//i.test(url)) {
        throw new Error("La URL debe empezar por http:// o https://");
      }
      patch.url = url;
    }
    if (args.workCenterIds !== undefined) {
      patch.workCenterIds = args.workCenterIds;
      patch.active = args.workCenterIds.length > 0;
    }
    if (args.active !== undefined) {
      patch.active = args.active;
    }

    await ctx.db.patch(args.fichaId, patch);
    return null;
  },
});

export const removeFichaAdmin = mutation({
  args: { fichaId: v.id("fichas") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const ficha = await ctx.db.get(args.fichaId);
    if (ficha === null) {
      throw new Error("Ficha no encontrada.");
    }
    await ctx.db.delete(args.fichaId);
    // Limpiar las traducciones huérfanas
    const translations = await ctx.db
      .query("fichaTranslations")
      .withIndex("byFicha", (q) => q.eq("fichaId", args.fichaId))
      .collect();
    for (const row of translations) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// Tipos de ficha — administración completa
// ---------------------------------------------------------------------------

export const createFichaType = mutation({
  args: {
    name: v.string(),
    icon: v.union(
      ...[
        "file-text",
        "shield-alert",
        "book-open",
        "list-checks",
        "wrench",
        "flask-conical",
        "hard-hat",
        "clipboard-list",
        "package",
        "zap",
      ].map((key) => v.literal(key)),
    ),
  },
  returns: v.object({ slug: v.string(), created: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length < 2) {
      throw new Error("El nombre del tipo necesita al menos 2 caracteres.");
    }

    const existingRows = await ctx.db.query("fichaTypes").collect();
    const existing = existingRows.find(
      (row) =>
        row.name.trim().toLowerCase() === name.toLowerCase() && row.hidden !== true,
    );
    if (existing) {
      throw new Error("Ya existe un tipo de ficha con ese nombre.");
    }

    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48);

    if (slug.length < 2) {
      throw new Error("Ese nombre no genera un identificador válido.");
    }

    const reused = existingRows.find(
      (row) => row.slug === slug && row.hidden === true,
    );
    if (reused) {
      await ctx.db.patch(reused._id, { name, icon: args.icon, hidden: false });
      return { slug: reused.slug, created: false };
    }

    const order =
      existingRows.length > 0
        ? Math.max(...existingRows.map((row) => row.order)) + 10
        : 50;

    const inserted = await ctx.db.insert("fichaTypes", {
      slug,
      name,
      icon: args.icon,
      order,
      hidden: false,
    });

    return { slug, created: true };
  },
});

export const updateFichaType = mutation({
  args: {
    typeId: v.id("fichaTypes"),
    name: v.string(),
    icon: v.union(
      ...[
        "file-text",
        "shield-alert",
        "book-open",
        "list-checks",
        "wrench",
        "flask-conical",
        "hard-hat",
        "clipboard-list",
        "package",
        "zap",
      ].map((key) => v.literal(key)),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const type = await ctx.db.get(args.typeId);
    if (type === null) {
      throw new Error("Tipo de ficha no encontrado.");
    }
    if (type.hidden === true) {
      throw new Error("No se puede editar un tipo retirado. Recupéralo primero.");
    }

    const name = args.name.trim();
    if (name.length < 2) {
      throw new Error("El nombre del tipo necesita al menos 2 caracteres.");
    }

    const allRows = await ctx.db.query("fichaTypes").collect();
    const duplicate = allRows.find(
      (row) =>
        row._id !== args.typeId &&
        row.hidden !== true &&
        row.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      throw new Error("Ya existe otro tipo de ficha con ese nombre.");
    }

    await ctx.db.patch(args.typeId, { name, icon: args.icon });
    return null;
  },
});

export const retireFichaType = mutation({
  args: { typeId: v.id("fichaTypes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const type = await ctx.db.get(args.typeId);
    if (type === null) {
      throw new Error("Tipo de ficha no encontrado.");
    }
    if (type.hidden === true) {
      throw new Error("Este tipo ya estaba retirado.");
    }

    const inUse = await ctx.db
      .query("fichas")
      .withIndex("byKind", (q) => q.eq("kind", type.slug))
      .collect();
    if (inUse.length > 0) {
      const plural = inUse.length === 1 ? "ficha usa" : "fichas usan";
      throw new Error(
        `No se puede retirar: ${inUse.length} ${plural} este tipo. Asígnalas a otro tipo primero.`,
      );
    }

    await ctx.db.patch(args.typeId, { hidden: true });
    return null;
  },
});

export const restoreFichaType = mutation({
  args: { typeId: v.id("fichaTypes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const type = await ctx.db.get(args.typeId);
    if (type === null) {
      throw new Error("Tipo de ficha no encontrado.");
    }
    if (type.hidden !== true) {
      throw new Error("Este tipo no estaba retirado.");
    }

    // Sólo choca si hay otro tipo visible con el mismo nombre (ignorando
    // acentos y mayúsculas). Antes se bloqueaba ante *cualquier* otro tipo
    // activo, lo que hacía imposible recuperar uno salvo que no hubiera más.
    const visible = mergeFichaTypes(await ctx.db.query("fichaTypes").collect());
    const nameDuplicate = visible.some(
      (t) =>
        t.slug !== type.slug &&
        !t.hidden &&
        sameFichaTypeName(t.name, type.name),
    );
    if (nameDuplicate) {
      throw new Error(
        "No se puede recuperar porque ya existe otro tipo activo con el mismo nombre.",
      );
    }

    await ctx.db.patch(args.typeId, { hidden: false });
    return null;
  },
});
