import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requireUser } from "./access";
import { ROLES } from "./schema";
import { fichaKindValidator, readVisibleFichaTypes } from "./fichaTypes";

/**
 * Backend for the ficha assistant. Convex actions cannot read the database
 * directly, so they go through this internal query, which is never callable
 * from the browser.
 *
 * The visibility rule is the same one the Fichas tab uses: admins see the whole
 * active catalog, everyone else only the fichas of their own work centers.
 */
export const visibleCatalog = internalQuery({
  args: {},
  returns: v.object({
    isAdmin: v.boolean(),
    centers: v.array(
      v.object({
        _id: v.id("workCenters"),
        name: v.string(),
        code: v.string(),
      }),
    ),
    fichas: v.array(
      v.object({
        _id: v.id("fichas"),
        title: v.string(),
        kind: fichaKindValidator,
        /** Etiqueta visible del tipo, ya resuelta para el modelo. */
        kindName: v.string(),
        productName: v.optional(v.string()),
        manufacturer: v.optional(v.string()),
        url: v.string(),
        workCenterIds: v.array(v.id("workCenters")),
        active: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const isAdmin = user.role === ROLES.ADMIN;
    const myCenters = user.workCenterIds ?? [];

    const centers = await ctx.db.query("workCenters").collect();
    const all = await ctx.db.query("fichas").collect();
    const visible = all.filter(
      (f) =>
        f.active &&
        (isAdmin || f.workCenterIds.some((c) => myCenters.includes(c))),
    );

    // Los nombres de los tipos se resuelven aquí para que las acciones (que no
    // pueden leer la base) reciban ya la etiqueta, incluidos los tipos nuevos.
    const types = await readVisibleFichaTypes(ctx);
    const nameOf = (kind: string) =>
      types.find((type) => type.slug === kind)?.name ?? kind;

    return {
      isAdmin,
      centers: centers.map((c) => ({ _id: c._id, name: c.name, code: c.code })),
      fichas: visible.map((f) => ({
        _id: f._id,
        title: f.title,
        kind: f.kind,
        kindName: nameOf(f.kind),
        productName: f.productName,
        manufacturer: f.manufacturer,
        url: f.url,
        workCenterIds: f.workCenterIds,
        active: f.active,
      })),
    };
  },
});
