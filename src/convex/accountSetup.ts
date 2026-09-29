import { ROLES } from "./schema";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export type AccountSetupArgs = {
  userId: Id<"users">;
  /** Null when the account is being created, set when an existing one signs in. */
  existingUserId: Id<"users"> | null;
  profile?: unknown;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Apply the pending invite (name, role, centers) to a newly created account.
 * The role stored on the invite was chosen by an administrator, so it takes
 * precedence over the default role.
 */
async function applyInviteForNewUser(
  ctx: MutationCtx,
  email: string | undefined,
  userId: Id<"users">,
): Promise<void> {
  if (!email) return;
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const invite = await ctx.db
    .query("invites")
    .filter((q) => q.eq(q.field("email"), normalized))
    .first();
  if (invite === null || invite.status !== "pending") return;

  await ctx.db.patch(userId, {
    role: invite.role,
    workCenterIds: invite.centerIds,
    ...(invite.name ? { name: invite.name } : null),
  });
  await ctx.db.patch(invite._id, { status: "accepted" });
}

/**
 * Every brand new account enters as a plain user; only an administrator can
 * promote or demote someone later on.
 *
 * This deliberately does nothing when the account already exists (it would
 * silently demote admins on every sign-in) nor when a role is already stored
 * (the invite just set it).
 */
async function assignDefaultRole(
  ctx: MutationCtx,
  userId: Id<"users">,
  existingUserId: Id<"users"> | null,
): Promise<void> {
  if (existingUserId !== null) return; // existing account signing in
  const user = await ctx.db.get(userId);
  if (user === null || user.role !== undefined) return;
  await ctx.db.patch(userId, { role: ROLES.USER });
}

/** Throw if the account has been blocked by an administrator. */
async function rejectBlockedUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (user?.blocked === true) {
    throw new Error(
      "Tu cuenta ha sido bloqueada por un administrador. Contacta con tu administrador si crees que es un error.",
    );
  }
}

/**
 * Runs after the auth provider creates or updates an account: applies a pending
 * invite, falls back to the default `user` role and enforces the block list.
 */
export async function applyAccountSetup(
  ctx: MutationCtx,
  args: AccountSetupArgs,
): Promise<void> {
  const profile = (args.profile ?? {}) as { email?: unknown };
  const email = typeof profile.email === "string" ? profile.email : undefined;

  await applyInviteForNewUser(ctx, email, args.userId);
  await assignDefaultRole(ctx, args.userId, args.existingUserId);
  await rejectBlockedUser(ctx, args.userId);
}
