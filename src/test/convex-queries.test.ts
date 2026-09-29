import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";

// `getAuthUserId` only reads `identity.subject`, so `t.withIdentity({ subject })`
// is enough to exercise the real permission logic end to end.
const modules = {
  "_generated/server": () => import("@/convex/_generated/server"),
  schema: () => import("@/convex/schema"),
  access: () => import("@/convex/access"),
  fichas: () => import("@/convex/fichas"),
};

type T = ReturnType<typeof setup>;

function setup() {
  return convexTest(schema, modules);
}

async function seed(t: T, memberCenterIndex: 0 | 1 = 1) {
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

  const fichaA = await admin.mutation(api.fichas.create, {
    title: "Detergente desinfectante",
    kind: "ficha_tecnica",
    productName: "Hypofoam",
    manufacturer: "Diversey",
    url: "https://example.com/a.pdf",
    workCenterIds: [centerA],
  });
  const fichaB = await admin.mutation(api.fichas.create, {
    title: "Manual de máquina",
    kind: "manual_instrucciones",
    url: "https://example.com/b.pdf",
    workCenterIds: [centerB],
  });

  const memberId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "member@example.com",
      role: "user",
      workCenterIds: [memberCenterIndex === 0 ? centerA : centerB],
    }),
  );
  const member = t.withIdentity({ subject: memberId });

  return { centerA, centerB, adminId, memberId, fichaA, fichaB, admin, member };
}

describe("access.listCenters (pestaña Centros)", () => {
  test("devuelve todos los centros al administrador", async () => {
    const { admin } = await seed(setup());
    const centers = await admin.query(api.access.listCenters, {});
    expect(centers.map((c) => c.code).sort()).toEqual(["MDLZ_GRA", "MDLZ_MON"]);
    expect(centers[0].name).toBeTruthy();
    expect(centers[0].address).toBeTruthy();
  });

  test("rechaza a los no administradores", async () => {
    const { member } = await seed(setup());
    await expect(member.query(api.access.listCenters, {})).rejects.toThrow(
      /administradores/i,
    );
  });

  test("rechaza a las cuentas bloqueadas", async () => {
    const t = setup();
    const { admin, memberId } = await seed(t);
    await admin.mutation(api.access.setUserBlocked, {
      userId: memberId,
      blocked: true,
    });
    await expect(
      t.withIdentity({ subject: memberId }).query(api.access.listCenters, {}),
    ).rejects.toThrow(/bloqueada/i);
  });
});

describe("access.listUsers", () => {
  test("normaliza workCenterIds para todos los usuarios", async () => {
    const { admin, memberId, centerB } = await seed(setup());
    const users = await admin.query(api.access.listUsers, {});
    expect(users).toHaveLength(2);
    const member = users.find((u) => u._id === memberId);
    expect(member?.workCenterIds).toEqual([centerB]);
  });
});

describe("access.listMyCenters", () => {
  test("solo devuelve los centros del propio usuario", async () => {
    const { centerA, centerB, member } = await seed(setup());
    const mine = await member.query(api.access.listMyCenters, {});
    expect(mine.map((c) => c._id)).toEqual([centerB]);
    expect(mine.map((c) => c._id)).not.toContain(centerA);
  });
});

describe("fichas.listAll (pestaña Fichas, admin)", () => {
  test("devuelve todas las fichas ordenadas por título", async () => {
    const { admin } = await seed(setup());
    const all = await admin.query(api.fichas.listAll, {});
    expect(all.map((f) => f.title)).toEqual([
      "Detergente desinfectante",
      "Manual de máquina",
    ]);
    expect(all[0].productName).toBe("Hypofoam");
    expect(all[1].productName).toBeUndefined();
  });

  test("rechaza a los no administradores", async () => {
    const { member } = await seed(setup());
    await expect(member.query(api.fichas.listAll, {})).rejects.toThrow(
      /administradores/i,
    );
  });
});

describe("fichas.listMine (pestaña Fichas)", () => {
  test("limita al usuario a las fichas de sus centros", async () => {
    const { member } = await seed(setup());
    const mine = await member.query(api.fichas.listMine, {});
    expect(mine.map((f) => f.title)).toEqual(["Manual de máquina"]);
  });

  test("el administrador ve todas", async () => {
    const { admin } = await seed(setup());
    const mine = await admin.query(api.fichas.listMine, {});
    expect(mine).toHaveLength(2);
  });

  test("oculta las fichas inactivas al usuario", async () => {
    const t = setup();
    const { memberId, fichaB, admin } = await seed(t);
    await admin.mutation(api.fichas.update, {
      fichaId: fichaB,
      active: false,
    });
    const mine = await t
      .withIdentity({ subject: memberId })
      .query(api.fichas.listMine, {});
    expect(mine).toHaveLength(0);
  });

  test("un usuario sin centros no ve ninguna ficha", async () => {
    const t = setup();
    const { memberId } = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(memberId, { workCenterIds: [] });
    });
    const mine = await t
      .withIdentity({ subject: memberId })
      .query(api.fichas.listMine, {});
    expect(mine).toHaveLength(0);
  });
});

describe("fichas.create / update", () => {
  test("admite fichas sin nombre de producto", async () => {
    const { admin, centerA } = await seed(setup());
    const id = await admin.mutation(api.fichas.create, {
      title: "Solo título",
      kind: "ficha_seguridad",
      url: "https://example.com/c.pdf",
      workCenterIds: [centerA],
    });
    const all = await admin.query(api.fichas.listAll, {});
    const created = all.find((f) => f._id === id);
    expect(created?.productName).toBeUndefined();
    expect(created?.manufacturer).toBeUndefined();
    expect(created?.active).toBe(true);
  });

  test("rechaza URLs sin protocolo", async () => {
    const { admin, centerA } = await seed(setup());
    await expect(
      admin.mutation(api.fichas.create, {
        title: "Mala URL",
        kind: "ficha_tecnica",
        url: "example.com/x.pdf",
        workCenterIds: [centerA],
      }),
    ).rejects.toThrow(/http/);
  });

  test("borrar un centro no rompe las fichas", async () => {
    const { admin, centerA } = await seed(setup());
    await admin.mutation(api.access.deleteCenter, { centerId: centerA });
    const all = await admin.query(api.fichas.listAll, {});
    expect(all).toHaveLength(2);
  });
});

describe("access.updateUser", () => {
  test("impide quedarse sin administradores", async () => {
    const { admin, adminId, memberId } = await seed(setup());
    await admin.mutation(api.access.updateUser, {
      userId: memberId,
      name: "Nuevo nombre",
    });
    const users = await admin.query(api.access.listUsers, {});
    expect(users.find((u) => u._id === memberId)?.name).toBe("Nuevo nombre");

    await expect(
      admin.mutation(api.access.updateUser, { userId: adminId, role: "user" }),
    ).rejects.toThrow(/administrador/i);
  });
});
