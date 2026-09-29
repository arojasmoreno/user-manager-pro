import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";
import { applyAccountSetup } from "@/convex/accountSetup";

const modules = {
  "_generated/server": () => import("@/convex/_generated/server"),
  schema: () => import("@/convex/schema"),
  access: () => import("@/convex/access"),
  accountSetup: () => import("@/convex/accountSetup"),
};

type T = ReturnType<typeof setup>;

function setup() {
  return convexTest(schema, modules);
}

/** Simulate the sign-in of an account the auth provider just created. */
async function signInNewAccount(t: T, email: string) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email, emailVerificationTime: 1 }),
  );
  await t.run(async (ctx) =>
    applyAccountSetup(ctx, {
      userId,
      existingUserId: null,
      profile: { email },
    }),
  );
  return userId;
}

describe("alta de cuentas: rol por defecto", () => {
  test("una cuenta nueva entra siempre como usuario", async () => {
    const t = setup();
    const userId = await signInNewAccount(t, "nuevo@example.com");

    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user?.role).toBe("user");
  });

  test("el rol de la invitación del administrador tiene prioridad", async () => {
    const t = setup();
    const centerId = await t.run(async (ctx) =>
      ctx.db.insert("workCenters", {
        name: "MDLZ Montornes",
        code: "MDLZ_MON",
        address: "Calle Raiguer 1",
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("invites", {
        email: "invitado@example.com",
        role: "admin",
        centerIds: [centerId],
        status: "pending",
      }),
    );

    const userId = await signInNewAccount(t, "invitado@example.com");

    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user?.role).toBe("admin");
    expect(user?.workCenterIds).toEqual([centerId]);
    const invite = await t.run(async (ctx) => ctx.db.query("invites").first());
    expect(invite?.status).toBe("accepted");
  });

  test("iniciar sesión no degrada a un administrador existente", async () => {
    const t = setup();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "admin@example.com", role: "admin" }),
    );
    await t.run(async (ctx) =>
      applyAccountSetup(ctx, {
        userId,
        existingUserId: userId,
        profile: { email: "admin@example.com" },
      }),
    );

    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user?.role).toBe("admin");
  });

  test("una cuenta bloqueada no puede entrar", async () => {
    const t = setup();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "bloqueado@example.com", blocked: true }),
    );

    await expect(
      t.run(async (ctx) =>
        applyAccountSetup(ctx, {
          userId,
          existingUserId: null,
          profile: { email: "bloqueado@example.com" },
        }),
      ),
    ).rejects.toThrow(/bloqueada/i);
  });
});

describe("solo el administrador cambia el rol", () => {
  async function seedAdminAndMember(t: T) {
    const adminId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "admin@example.com", role: "admin" }),
    );
    const memberId = await signInNewAccount(t, "usuario@example.com");
    return { admin: t.withIdentity({ subject: adminId }), adminId, memberId };
  }

  test("un usuario no puede cambiar su propio rol", async () => {
    const t = setup();
    const { memberId } = await seedAdminAndMember(t);
    const memberSession = t.withIdentity({ subject: memberId });

    await expect(
      memberSession.mutation(api.access.updateUser, {
        userId: memberId,
        role: "admin",
      }),
    ).rejects.toThrow(/administradores/i);

    // Su rol sigue siendo el de usuario.
    const stored = await t.run(async (ctx) => ctx.db.get(memberId));
    expect(stored?.role).toBe("user");
  });

  test("un usuario no puede cambiar el rol de otro", async () => {
    const t = setup();
    const { adminId, memberId } = await seedAdminAndMember(t);
    const memberSession = t.withIdentity({ subject: memberId });

    await expect(
      memberSession.mutation(api.access.updateUser, {
        userId: adminId,
        role: "user",
      }),
    ).rejects.toThrow(/administradores/i);

    const admin = await t.run(async (ctx) => ctx.db.get(adminId));
    expect(admin?.role).toBe("admin");
  });

  test("el administrador sí puede cambiar el rol", async () => {
    const t = setup();
    const { admin, memberId } = await seedAdminAndMember(t);

    await admin.mutation(api.access.updateUser, {
      userId: memberId,
      role: "admin",
    });
    const promoted = await t.run(async (ctx) => ctx.db.get(memberId));
    expect(promoted?.role).toBe("admin");

    await admin.mutation(api.access.updateUser, {
      userId: memberId,
      role: "user",
    });
    const demoted = await t.run(async (ctx) => ctx.db.get(memberId));
    expect(demoted?.role).toBe("user");
  });

  test("un usuario no puede tocar la lista de usuarios", async () => {
    const t = setup();
    const { memberId } = await seedAdminAndMember(t);
    const memberSession = t.withIdentity({ subject: memberId });

    await expect(
      memberSession.query(api.access.listUsers, {}),
    ).rejects.toThrow(/administradores/i);
  });
});

describe("compatibilidad con cuentas antiguas", () => {
  test("una cuenta sin rol guardado se muestra como usuario", async () => {
    const t = setup();
    const adminId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "admin@example.com", role: "admin" }),
    );
    const legacyId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "legacy@example.com" }),
    );
    const admin = t.withIdentity({ subject: adminId });

    const users = await admin.query(api.access.listUsers, {});
    expect(users.find((u) => u._id === legacyId)?.role).toBe("user");

    const byId = await admin.query(api.access.userById, { userId: legacyId });
    expect(byId?.role).toBe("user");
  });
});

describe("bootstrap del primer administrador", () => {
  test("no se puede reclamar si ya existe un administrador", async () => {
    const t = setup();
    await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "admin@example.com", role: "admin" }),
    );
    const otherId = await signInNewAccount(t, "otro@example.com");
    const other = t.withIdentity({ subject: otherId });

    expect(await other.mutation(api.access.consumeBootstrapPromo, {})).toBe(
      false,
    );
    const stored = await t.run(async (ctx) => ctx.db.get(otherId));
    expect(stored?.role).toBe("user");
  });

  test("una instalación sin administradores puede bootstrapearse una vez", async () => {
    const t = setup();
    const firstId = await signInNewAccount(t, "primero@example.com");
    const first = t.withIdentity({ subject: firstId });
    expect(await first.mutation(api.access.consumeBootstrapPromo, {})).toBe(true);

    const secondId = await signInNewAccount(t, "segundo@example.com");
    const second = t.withIdentity({ subject: secondId });
    expect(await second.mutation(api.access.consumeBootstrapPromo, {})).toBe(
      false,
    );
  });
});
