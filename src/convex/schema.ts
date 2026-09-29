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
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      workCenterIds: v.optional(v.array(v.id("workCenters"))),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ---------------------------------------------------------------------------
    // Domain tables (v1)
    // ---------------------------------------------------------------------------

    // Work centers ("centros de trabajo")
    workCenters: defineTable({
      name: v.string(),
      code: v.string(),
      address: v.string(),
    }).index("code", ["code"]),

    // Chemical product data sheets: fichas técnicas and fichas de seguridad
    fichas: defineTable({
      title: v.string(),
      kind: v.union(v.literal("ficha_tecnica"), v.literal("ficha_seguridad")),
      productName: v.string(),
      manufacturer: v.optional(v.string()),
      url: v.string(),
      workCenterIds: v.array(v.id("workCenters")),
      active: v.boolean(),
    }).index("active", ["active"]),

    // Admin-created invitations (admin "adds users" by email)
    invites: defineTable({
      email: v.string(),
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
