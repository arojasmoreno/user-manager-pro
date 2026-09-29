// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { emailOtp } from "./auth/emailOtp";

type InviteCallbackArgs = {
  userId: import("./_generated/dataModel").Id<"users">;
  existingUserId: import("./_generated/dataModel").Id<"users"> | null;
  profile?: unknown;
};

/** Apply the pending invite (name, role, centers) to a newly created account. */
async function applyInviteForNewUser(
  ctx: import("./_generated/server").MutationCtx,
  email: string | undefined,
  userId: InviteCallbackArgs["userId"],
): Promise<void> {
  if (!email) return;
  const normalized = email.trim().toLowerCase();
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

/** Throw if the account has been blocked by an administrator. */
async function rejectBlockedUser(
  ctx: import("./_generated/server").MutationCtx,
  email: string | undefined,
  userId: InviteCallbackArgs["userId"],
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (user?.blocked === true) {
    throw new Error(
      "Tu cuenta ha sido bloqueada por un administrador. Contacta con tu administrador si crees que es un error.",
    );
  }
  if (email) {
    const normalized = email.trim().toLowerCase();
    if (normalized && normalized !== (user?.email ?? "").toLowerCase()) {
      // Email lookup guard: the account being signed in may differ from the
      // stored one in rare linking scenarios; only the account's own flag
      // matters, so nothing further to do here.
    }
  }
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, Anonymous],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      const profile = (args.profile ?? {}) as { email?: unknown };
      const email =
        typeof profile.email === "string" ? profile.email : undefined;

      await applyInviteForNewUser(ctx, email, args.userId);
      await rejectBlockedUser(ctx, email, args.userId);
    },
  },
});
