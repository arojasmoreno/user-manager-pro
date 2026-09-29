import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "@/convex/schema";
import { api, internal } from "@/convex/_generated/api";

const modules = {
  "_generated/server": () => import("@/convex/_generated/server"),
  schema: () => import("@/convex/schema"),
  access: () => import("@/convex/access"),
  fichas: () => import("@/convex/fichas"),
  fichaIndex: () => import("@/convex/fichaIndex"),
};

function setup() {
  return convexTest(schema, modules);
}

type T = ReturnType<typeof setup>;

async function seedInto(t: T) {
  const adminId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "admin@example.com",
      role: "admin",
      workCenterIds: [],
    }),
  );
  const admin = t.withIdentity({ subject: adminId });

  const centerA = await admin.mutation(api.access.createCenter, {
    name: "MDLZ Montornes",
    code: "MDLZ_MON",
    address: "Calle Raiguer 1",
  });
  const centerB = await admin.mutation(api.access.createCenter, {
    name: "Granollers",
    code: "MDLZ_GRA",
    address: "Calle Galileo Galilei 2",
  });

  await admin.mutation(api.fichas.create, {
    title: "Detergente desinfectante",
    kind: "ficha_tecnica",
    productName: "Hypofoam",
    manufacturer: "Diversey",
    url: "https://example.com/a.pdf",
    workCenterIds: [centerA],
  });
  const inactive = await admin.mutation(api.fichas.create, {
    title: "Ficha retirada",
    kind: "ficha_seguridad",
    url: "https://example.com/z.pdf",
    workCenterIds: [centerB],
  });
  await admin.mutation(api.fichas.update, {
    fichaId: inactive,
    active: false,
  });

  return { centerA, centerB, admin };
}

async function seed() {
  const t = setup();
  const { centerA, centerB, admin } = await seedInto(t);
  const memberId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "member@example.com",
      role: "user",
      workCenterIds: [centerB],
    }),
  );
  return { t, centerA, centerB, admin, memberId };
}

describe("internal.fichaIndex.visibleCatalog", () => {
  test("el administrador ve todo el catálogo activo", async () => {
    const { admin } = await seed();
    const catalog = await admin.query(internal.fichaIndex.visibleCatalog, {});
    expect(catalog.isAdmin).toBe(true);
    expect(catalog.fichas.map((f) => f.title)).toEqual([
      "Detergente desinfectante",
    ]);
    expect(catalog.centers).toHaveLength(2);
  });

  test("un usuario solo ve las fichas de sus centros", async () => {
    const t = setup();
    const { centerB } = await seedInto(t);
    const memberId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "member@example.com",
        role: "user",
        workCenterIds: [centerB],
      }),
    );
    // La única ficha de Granollers quedó inactiva, así que no ve nada.
    const catalog = await t
      .withIdentity({ subject: memberId })
      .query(internal.fichaIndex.visibleCatalog, {});
    expect(catalog.isAdmin).toBe(false);
    expect(catalog.fichas).toEqual([]);
  });

  test("un usuario ve la ficha de su centro y no las de los demás", async () => {
    const t = setup();
    const { centerB } = await seedInto(t);
    await t.run(async (ctx) => {
      const f = await ctx.db.query("fichas").first();
      if (f) await ctx.db.patch(f._id, { workCenterIds: [centerB] });
    });
    const memberId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "member@example.com",
        role: "user",
        workCenterIds: [centerB],
      }),
    );
    const catalog = await t
      .withIdentity({ subject: memberId })
      .query(internal.fichaIndex.visibleCatalog, {});
    expect(catalog.fichas.map((f) => f.title)).toEqual([
      "Detergente desinfectante",
    ]);
  });

  test("exige iniciar sesión", async () => {
    const { t } = await seed();
    await expect(t.query(internal.fichaIndex.visibleCatalog, {})).rejects.toThrow(
      /iniciar sesión/i,
    );
  });

  test("rechaza a las cuentas bloqueadas", async () => {
    const { t, admin, memberId } = await seed();
    await admin.mutation(api.access.setUserBlocked, {
      userId: memberId,
      blocked: true,
    });
    await expect(
      t.withIdentity({ subject: memberId }).query(internal.fichaIndex.visibleCatalog, {}),
    ).rejects.toThrow(/bloqueada/i);
  });
});
