import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),

      role: v.optional(roleValidator),
      workCenterIds: v.optional(v.array(v.id("workCenters"))),
      /** Admin-set block flag: blocked users cannot sign in. */
      blocked: v.optional(v.boolean()),
    }).index("email", ["email"]),

    // Work centers ("centros de trabajo")
    workCenters: defineTable({
      name: v.string(),
      code: v.string(),
      address: v.string(),
    }).index("code", ["code"]),

    // Catalog items: fichas técnicas, fichas de seguridad, manuales de
    // máquina e instrucciones de trabajo. Each belongs to one or more work
    // centers and points at a document (URL or Supabase storage path).
    fichas: defineTable({
      title: v.string(),
      kind: v.union(
        v.literal("ficha_tecnica"),
        v.literal("ficha_seguridad"),
        v.literal("manual_instrucciones"),
        v.literal("instrucciones_trabajo"),
      ),
      /** Product or equipment the sheet refers to (optional). */
      productName: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
      url: v.string(),
      workCenterIds: v.array(v.id("workCenters")),
      active: v.boolean(),
    }).index("active", ["active"]),

    // Admin-created invitations (admin "adds users" by email)
    invites: defineTable({
      email: v.string(),
      name: v.optional(v.string()),
      role: roleValidator,
      centerIds: v.array(v.id("workCenters")),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("revoked"),
      ),
    }).index("email", ["email"]),

    // One-shot app metadata (e.g. bootstrap admin promo marker)
    appMeta: defineTable({
      bootstrapPromoUsed: v.boolean(),
    }),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
