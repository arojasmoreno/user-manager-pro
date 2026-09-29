// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { emailOtp } from "./auth/emailOtp";

type InviteCallbackArgs = {
  userId: import("./_generated/dataModel").Id<"users">;
  existingUserId: import("./_generated/dataModel").Id<"users"> | null;
  profile?: { email?: string } | null;
};

/** Apply the pending invite (role + centers) to a newly created account. */
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
  });
  await ctx.db.patch(invite._id, { status: "accepted" });
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, Anonymous],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      const email =
        args.profile && typeof args.profile === "object"
          ? (args.profile as { email?: unknown }).email
          : undefined;
      await applyInviteForNewUser(
        ctx,
        typeof email === "string" ? email : undefined,
        args.userId,
      );
    },
  },
});
