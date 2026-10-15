import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";
import { LOCALE_CODES } from "../i18n/locales";

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

/** Locales a ficha can be translated into. */
export const localeValidator = v.union(
  ...LOCALE_CODES.map((code) => v.literal(code)),
);
export type LocaleCode = Infer<typeof localeValidator>;

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

    // Ficha types ("tipos de ficha"). The four classic types are not rows:
    // `mergeFichaTypes` folds them in on read, so a database that already has
    // fichas with the old literal kinds keeps working without a migration. A
    // row with a classic slug overrides it; `hidden: true` retires it.
    fichaTypes: defineTable({
      slug: v.string(),
      name: v.string(),
      icon: v.string(),
      order: v.number(),
      hidden: v.optional(v.boolean()),
    }).index("slug", ["slug"]),

    // Catalog items: technical sheets, safety sheets, machine manuals and work
    // instructions — plus any type the administrator adds. `kind` stores the
    // slug of a row in `fichaTypes`; `fichas.create` and `fichas.update` reject
    // slugs that are not a visible type. It is a plain string (instead of a
    // union) so new types do not require a schema change. Each ficha belongs to
    // one or more work centers and points at a document (URL or Supabase path).
    fichas: defineTable({
      title: v.string(),
      kind: v.string(),
      /** Product or equipment the sheet refers to (optional). */
      productName: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
      url: v.string(),
      workCenterIds: v.array(v.id("workCenters")),
      active: v.boolean(),
    })
      .index("active", ["active"])
      .index("byKind", ["kind"]),

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

    // One translated version of a ficha's own fields. Created either by the
    // admin by hand or by the AI translation action; one row per ficha+locale.
    fichaTranslations: defineTable({
      fichaId: v.id("fichas"),
      locale: localeValidator,
      title: v.string(),
      productName: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
      source: v.union(v.literal("ai"), v.literal("manual")),
      _creationTime: v.number(),
    })
      .index("byFicha", ["fichaId"])
      .index("byFichaLocale", ["fichaId", "locale"])
      .index("byLocale", ["locale"]),

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
