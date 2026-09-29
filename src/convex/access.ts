import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { ROLES, roleValidator } from "./schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Necesitas iniciar sesión.");
  }
  const user = await ctx.db.get(userId);
  if (user?.blocked === true) {
    throw new Error("Tu cuenta ha sido bloqueada por un administrador.");
  }
  if (user?.role !== ROLES.ADMIN) {
    throw new Error("Solo los administradores pueden realizar esta acción.");
  }
  return user;
}

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Necesitas iniciar sesión.");
  }
  const user = await ctx.db.get(userId);
  if (user === null) {
    throw new Error("Usuario no encontrado.");
  }
  if (user.blocked === true) {
    throw new Error("Tu cuenta ha sido bloqueada por un administrador.");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const userById = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      image: v.optional(v.string()),
      role: v.optional(roleValidator),
      workCenterIds: v.optional(v.array(v.id("workCenters"))),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.userId);
    if (doc === null) return null;
    return {
      _id: doc._id,
      name: doc.name,
      email: doc.email,
      image: doc.image,
      // Accounts created before roles were enforced may still have no role
      // stored; they behave as plain users everywhere else.
      role: doc.role ?? ROLES.USER,
      workCenterIds: doc.workCenterIds ?? [],
    };
  },
});

export const listUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      role: v.optional(roleValidator),
      workCenterIds: v.array(v.id("workCenters")),
      blocked: v.optional(v.boolean()),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role ?? ROLES.USER,
      workCenterIds: u.workCenterIds ?? [],
      blocked: u.blocked,
      _creationTime: u._creationTime,
    }));
  },
});

export const listCenters = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("workCenters"),
      name: v.string(),
      code: v.string(),
      address: v.string(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("workCenters").order("desc").collect();
  },
});

// The signed-in user's own work centers (used to label their fichas).
export const listMyCenters = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("workCenters"),
      name: v.string(),
      code: v.string(),
      address: v.string(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const mine = user.workCenterIds ?? [];
    const centers = await ctx.db.query("workCenters").collect();
    return centers
      .filter((c) => mine.includes(c._id))
      .map((c) => ({
        _id: c._id,
        name: c.name,
        code: c.code,
        address: c.address,
        _creationTime: c._creationTime,
      }));
  },
});

// ---------------------------------------------------------------------------
// Mutations — users
// ---------------------------------------------------------------------------

/**
 * Edit a user. Administrator only (`requireAdmin`): nobody — including the
 * account being edited — can change a role on their own. A user always keeps
 * whatever role the last administrator gave them.
 */
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    role: v.optional(roleValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const { userId, ...fields } = args;
    if (userId === me._id && fields.role !== undefined && fields.role !== ROLES.ADMIN) {
      throw new Error("No puedes quitarte a ti mismo el rol de administrador.");
    }
    if (fields.role !== undefined && fields.role !== ROLES.ADMIN) {
      const anyOtherAdmin = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("role"), ROLES.ADMIN))
        .filter((q) => q.neq(q.field("_id"), userId))
        .first();
      if (anyOtherAdmin === null) {
        throw new Error("Debe existir al menos un administrador.");
      }
    }
    await ctx.db.patch(userId, fields);
    return null;
  },
});

export const setUserCenters = mutation({
  args: {
    userId: v.id("users"),
    centerIds: v.array(v.id("workCenters")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.userId, { workCenterIds: args.centerIds });
    return null;
  },
});

export const promoteToAdmin = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.userId, { role: ROLES.ADMIN });
    return null;
  },
});

/**
 * Block or unblock a user. A blocked user cannot sign in; their data and
 * center assignments remain intact while blocked.
 */
export const setUserBlocked = mutation({
  args: { userId: v.id("users"), blocked: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    if (args.userId === me._id) {
      throw new Error("No puedes bloquear tu propia cuenta.");
    }
    await ctx.db.patch(args.userId, { blocked: args.blocked });
    return null;
  },
});

/** Permanently delete a user account (admin action). */
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    if (args.userId === me._id) {
      throw new Error("No puedes eliminar tu propia cuenta.");
    }
    const target = await ctx.db.get(args.userId);
    if (target === null) return null;
    if (target.role === ROLES.ADMIN) {
      const otherAdmin = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("role"), ROLES.ADMIN))
        .filter((q) => q.neq(q.field("_id"), args.userId))
        .first();
      if (otherAdmin === null) {
        throw new Error("No puedes eliminar al último administrador.");
      }
    }
    // Detach the user from any work centers before deleting.
    if ((target.workCenterIds ?? []).length > 0) {
      await ctx.db.patch(args.userId, { workCenterIds: [] });
    }
    await ctx.db.delete(args.userId);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Mutations — work centers
// ---------------------------------------------------------------------------

export const createCenter = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    address: v.string(),
  },
  returns: v.id("workCenters"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("workCenters")
      .filter((q) => q.eq(q.field("code"), args.code.trim().toUpperCase()))
      .first();
    if (existing !== null) {
      throw new Error("Ya existe un centro de trabajo con ese código.");
    }
    return await ctx.db.insert("workCenters", {
      name: args.name.trim(),
      code: args.code.trim().toUpperCase(),
      address: args.address.trim(),
    });
  },
});

export const deleteCenter = mutation({
  args: { centerId: v.id("workCenters") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Remove the center from all users assigned to it
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      const ids = u.workCenterIds ?? [];
      if (ids.includes(args.centerId)) {
        await ctx.db.patch(u._id, {
          workCenterIds: ids.filter((id) => id !== args.centerId),
        });
      }
    }
    // Remove the center from all fichas that point at it
    const fichas = await ctx.db.query("fichas").collect();
    for (const f of fichas) {
      const ids = f.workCenterIds ?? [];
      if (ids.includes(args.centerId)) {
        const next = ids.filter((id) => id !== args.centerId);
        await ctx.db.patch(f._id, {
          workCenterIds: next,
          ...(next.length === 0 ? { active: false } : null),
        });
      }
    }
    await ctx.db.delete(args.centerId);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Mutations — invitations
// ---------------------------------------------------------------------------

export const inviteUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    role: roleValidator,
    centerIds: v.array(v.id("workCenters")),
  },
  returns: v.object({ inviteId: v.id("invites"), created: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const email = normalizeEmail(args.email);
    if (!email.includes("@") || email.length < 3) {
      throw new Error("Introduce un correo electrónico válido.");
    }

    const existing = await ctx.db
      .query("invites")
      .filter((q) => q.eq(q.field("email"), email))
      .first();

    if (existing !== null && existing.status === "pending") {
      // Update the pending invite with the latest role/center configuration.
      await ctx.db.patch(existing._id, {
        role: args.role,
        centerIds: args.centerIds,
        ...(args.name !== undefined ? { name: args.name.trim() || undefined } : null),
      });
      return { inviteId: existing._id, created: false };
    }

    if (existing !== null && existing.status === "accepted") {
      throw new Error("Ese usuario ya aceptó su invitación.");
    }

    const inviteId = await ctx.db.insert("invites", {
      email,
      ...(args.name !== undefined ? { name: args.name.trim() || undefined } : null),
      role: args.role,
      centerIds: args.centerIds,
      status: "pending",
    });
    return { inviteId, created: true };
  },
});

export const listInvites = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("invites"),
      email: v.string(),
      role: roleValidator,
      status: v.string(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const invites = await ctx.db.query("invites").order("desc").collect();
    return invites.map((i) => ({
      _id: i._id,
      email: i.email,
      role: i.role,
      status: i.status,
      _creationTime: i._creationTime,
    }));
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("invites") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.inviteId, { status: "revoked" });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Bootstrap safety valve: the very first account of an installation with no
// administrator at all can claim the admin role, so a fresh deployment is never
// locked out. As soon as one admin exists, roles are only changed by an admin.
// Guarded by a one-shot marker in appMeta.
// ---------------------------------------------------------------------------

export const consumeBootstrapPromo = mutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const user = await ctx.db.get(userId);
    if (user === null || user.blocked === true) return false;
    if (user.role === ROLES.ADMIN) return false;

    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.ADMIN))
      .first();
    if (existingAdmin !== null) return false;

    const meta = await ctx.db.query("appMeta").first();
    if (meta !== null && meta.bootstrapPromoUsed) return false;

    if (meta === null) {
      await ctx.db.insert("appMeta", { bootstrapPromoUsed: true });
    } else {
      await ctx.db.patch(meta._id, { bootstrapPromoUsed: true });
    }
    await ctx.db.patch(userId, { role: ROLES.ADMIN });
    return true;
  },
});
