import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAdmin, requireUser } from "./access";
import {
  DEFAULT_FICHA_ICON,
  FICHA_ICON_KEYS,
  mergeFichaTypes,
  nextFichaTypeOrder,
  sameFichaTypeName,
  slugifyFichaType,
  type FichaType,
} from "../lib/fichaTypes";

/**
 * Tipos de ficha («categorías» del catálogo).
 *
 * El administrador los crea, los renombra y los retira desde la pestaña de
 * fichas. `fichas.kind` guarda el `slug` de uno de estos tipos, así que añadir
 * una categoría nueva no necesita tocar el esquema.
 *
 * Los cuatro tipos de serie se fusionan en cada lectura (`mergeFichaTypes`), no
 * son filas obligatorias: así los catálogos que ya existían conservan sus
 * etiquetas sin migración.
 */

/** Iconos admitidos: la clave que se guarda, no el icono del cliente. */
export const fichaIconValidator = v.union(
  ...FICHA_ICON_KEYS.map((key) => v.literal(key)),
);

/** `kind` de una ficha: el identificador de un tipo, validado al escribir. */
export const fichaKindValidator = v.string();

const typeShape = {
  slug: v.string(),
  name: v.string(),
  icon: v.string(),
  order: v.number(),
  builtIn: v.boolean(),
  hidden: v.boolean(),
};

const toFichaType = (type: FichaType) => ({
  slug: type.slug,
  name: type.name,
  icon: type.icon,
  order: type.order,
  builtIn: type.builtIn,
  hidden: type.hidden,
});

const readRows = async (ctx: QueryCtx | MutationCtx) =>
  await ctx.db.query("fichaTypes").collect();

/** Tipos visibles: los que la interfaz ofrece al crear o filtrar fichas. */
export async function readVisibleFichaTypes(
  ctx: QueryCtx | MutationCtx,
): Promise<FichaType[]> {
  return mergeFichaTypes(await readRows(ctx));
}

/**
 * Comprueba que `kind` es un tipo visible antes de guardar una ficha. Sustituye
 * a la antigua unión de literales del esquema: ahora la lista la decide el
 * administrador, pero el backend sigue rechazando cualquier valor inventado.
 */
export async function assertVisibleFichaType(
  ctx: QueryCtx | MutationCtx,
  kind: string,
): Promise<FichaType> {
  const type = (await readVisibleFichaTypes(ctx)).find((t) => t.slug === kind);
  if (!type) {
    throw new Error(
      "Ese tipo de ficha no existe. Elige uno de los tipos disponibles.",
    );
  }
  return type;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Tipos disponibles para cualquier usuario con sesión (etiquetas y filtros). */
export const listTypes = query({
  args: {},
  returns: v.array(v.object(typeShape)),
  handler: async (ctx) => {
    await requireUser(ctx);
    return (await readVisibleFichaTypes(ctx)).map(toFichaType);
  },
});

/**
 * Panel de gestión: incluye los tipos retirados y cuántas fichas usa cada uno,
 * para que el administrador sepa si puede borrarlo.
 *
 * También incluye los `kind` huérfanos: fichas cuyo tipo ya no está en la lista
 * (por ejemplo, datos anteriores a esta función). Sin ellos, esas fichas solo
 * aparecerían bajo «Todas» y no habría forma de reasignarlas.
 */
export const listTypesAdmin = query({
  args: {},
  returns: v.array(
    v.object({ ...typeShape, fichaCount: v.number() }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const listed = mergeFichaTypes(await readRows(ctx), {
      includeHidden: true,
    });

    const counts = new Map<string, number>();
    for (const ficha of await ctx.db.query("fichas").collect()) {
      counts.set(ficha.kind, (counts.get(ficha.kind) ?? 0) + 1);
    }

    const known = new Set(listed.map((t) => t.slug));
    const orphans: FichaType[] = [...counts.keys()]
      .filter((slug) => !known.has(slug))
      .map((slug) => ({
        slug,
        name: slug,
        icon: DEFAULT_FICHA_ICON,
        order: Number.MAX_SAFE_INTEGER,
        builtIn: false,
        hidden: false,
      }));

    return [...listed, ...orphans].map((type) => ({
      ...toFichaType(type),
      fichaCount: counts.get(type.slug) ?? 0,
    }));
  },
});

// ---------------------------------------------------------------------------
// Mutations (admin)
// ---------------------------------------------------------------------------

/**
 * Crea un tipo de ficha. Si ya existía uno retirado con el mismo identificador,
 * se recupera en lugar de duplicarlo, para que borrar por error sea reversible.
 */
export const createType = mutation({
  args: { name: v.string(), icon: fichaIconValidator },
  returns: v.object({ slug: v.string(), created: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const name = args.name.trim();
    if (name.length < 2) {
      throw new Error("El nombre del tipo necesita al menos 2 caracteres.");
    }
    const slug = slugifyFichaType(name);
    if (slug.length < 2) {
      throw new Error(
        "Ese nombre no genera un identificador válido. Usa letras o números.",
      );
    }

    const rows = await readRows(ctx);
    const all = mergeFichaTypes(rows, { includeHidden: true });
    if (
      all.some((type) => !type.hidden && sameFichaTypeName(type.name, name))
    ) {
      throw new Error("Ya existe un tipo de ficha con ese nombre.");
    }

    // Volver a escribir el nombre de un tipo retirado lo recupera. Se busca por
    // nombre, y no solo por identificador, porque el de un tipo de serie no
    // tiene por qué coincidir: «Instrucción de trabajo» da
    // `instruccion_de_trabajo`, mientras que el slug de fábrica es
    // `instrucciones_trabajo`.
    const retired = all.find(
      (type) => type.hidden && sameFichaTypeName(type.name, name),
    );
    const target = retired
      ? rows.find((row) => row.slug === retired.slug)
      : rows.find((row) => row.slug === slug);

    if (target) {
      if (target.hidden !== true) {
        throw new Error(
          "Ya existe un tipo de ficha con ese nombre o uno equivalente.",
        );
      }
      await ctx.db.patch(target._id, { name, icon: args.icon, hidden: false });
      return { slug: target.slug, created: false };
    }

    await ctx.db.insert("fichaTypes", {
      slug,
      name,
      icon: args.icon,
      order: nextFichaTypeOrder(rows),
      hidden: false,
    });
    return { slug, created: true };
  },
});

/**
 * Renombra un tipo o le cambia el icono. El identificador (`slug`) no cambia
 * nunca: es lo que guardan todas las fichas de ese tipo.
 */
export const updateType = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    icon: fichaIconValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const rows = await readRows(ctx);
    const all = mergeFichaTypes(rows, { includeHidden: true });
    const current = all.find((type) => type.slug === args.slug);
    if (!current) {
      throw new Error("Ese tipo de ficha ya no existe.");
    }

    const name = args.name.trim();
    if (name.length < 2) {
      throw new Error("El nombre del tipo necesita al menos 2 caracteres.");
    }
    if (
      all.some(
        (type) =>
          type.slug !== args.slug &&
          !type.hidden &&
          sameFichaTypeName(type.name, name),
      )
    ) {
      throw new Error("Ya existe un tipo de ficha con ese nombre.");
    }

    const stored = rows.find((row) => row.slug === args.slug);
    if (stored) {
      // Se conserva el estado: un tipo retirado se edita sin volver a
      // aparecer en la lista hasta que el administrador lo recupere.
      await ctx.db.patch(stored._id, { name, icon: args.icon });
      return null;
    }

    // Tipo de serie todavía sin fila propia: se crea el registro que lo
    // sobrescribe, conservando su posición en la lista.
    await ctx.db.insert("fichaTypes", {
      slug: args.slug,
      name,
      icon: args.icon,
      order: current.order,
      hidden: false,
    });
    return null;
  },
});

/**
 * Retira un tipo. Se niega mientras haya fichas que lo usen: borrarlo antes
 * dejaría documentos sin categoría y fuera de los filtros.
 */
export const deleteType = mutation({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const rows = await readRows(ctx);
    const current = mergeFichaTypes(rows, { includeHidden: true }).find(
      (type) => type.slug === args.slug,
    );
    if (!current || current.hidden) {
      throw new Error("Ese tipo de ficha ya no existe.");
    }

    const inUse = await ctx.db
      .query("fichas")
      .filter((q) => q.eq(q.field("kind"), args.slug))
      .collect();
    if (inUse.length > 0) {
      const plural = inUse.length === 1 ? "ficha usa" : "fichas usan";
      throw new Error(
        `No se puede borrar: ${inUse.length} ${plural} este tipo. Asígnalas a otro tipo primero.`,
      );
    }

    const stored = rows.find((row) => row.slug === args.slug);
    if (stored) {
      await ctx.db.patch(stored._id, { hidden: true });
      return null;
    }

    // Tipo de serie sin fila propia: se retira con un registro oculto para que
    // no vuelva a aparecer al fusionar los tipos de fábrica.
    await ctx.db.insert("fichaTypes", {
      slug: args.slug,
      name: current.name,
      icon: current.icon,
      order: current.order,
      hidden: true,
    });
    return null;
  },
});

/** Un tipo retirado vuelve a estar disponible, con su nombre e icono. */
export const restoreType = mutation({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const stored = (await readRows(ctx)).find(
      (row) => row.slug === args.slug,
    );
    if (!stored || stored.hidden !== true) {
      throw new Error("Ese tipo de ficha no está retirado.");
    }
    await ctx.db.patch(stored._id, { hidden: false });
    return null;
  },
});
