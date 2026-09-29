import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";
import {
  calls,
  __reset,
  __setFailure,
  __setReply,
} from "./fakes/fakeGemini";

// The assistant imports the Gemini client by relative path, so the stub has to
// intercept the module itself rather than the convex-test module map (which
// only registers functions, it does not rewrite their imports).
vi.mock("@/convex/gemini", async () => {
  const fake = await import("@/test/fakes/fakeGemini");
  return {
    answerFromContext: fake.answerFromContext,
    AiNotConfiguredError: fake.AiNotConfiguredError,
  };
});

/**
 * End-to-end tests of the assistant action. Only the outbound Gemini call is
 * faked; the internal catalog query, the permission rules and the ranking run
 * exactly as in production.
 */
const modules = {
  "_generated/server": () => import("@/convex/_generated/server"),
  schema: () => import("@/convex/schema"),
  access: () => import("@/convex/access"),
  fichas: () => import("@/convex/fichas"),
  fichaIndex: () => import("@/convex/fichaIndex"),
  assistant: () => import("@/convex/assistant"),
  ai: () => import("@/convex/ai"),
};

type T = ReturnType<typeof setup>;

function setup() {
  return convexTest(schema, modules);
}

async function seed(t: T) {
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
    name: "MDLZ Granollers",
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
      email: "usuario@example.com",
      role: "user",
      workCenterIds: [centerB],
    }),
  );

  return {
    admin,
    adminId,
    centerA,
    centerB,
    fichaA,
    fichaB,
    member: t.withIdentity({ subject: memberId }),
    memberId,
  };
}

beforeEach(() => {
  __reset();
});

describe("ai.askFichaQuestion (asistente)", () => {
  test("responde con la respuesta del modelo y sus fuentes", async () => {
    const { admin, fichaA } = await seed(setup());
    __setReply("Usad Hypofoam de Diversey [1].");

    const result = await admin.action(api.ai.askFichaQuestion, {
      question: "¿Qué descontinfectante usamos?",
    });

    expect(result.answer).toBe("Usad Hypofoam de Diversey [1].");
    expect(result.catalogSize).toBe(2);
    const source = result.sources.find((s) => s._id === fichaA);
    expect(source?.title).toBe("Detergente desinfectante");
    expect(source?.centerNames).toEqual(["MDLZ Montornes"]);
    // The ficha label must reach the model so it can cite it.
    expect(source?.kind).toBe("ficha_tecnica");
  });

  test("ordena primero las fichas que más se parecen a la pregunta", async () => {
    const { admin } = await seed(setup());

    await admin.action(api.ai.askFichaQuestion, {
      question: "¿manual de máquina?",
    });

    expect(calls).toHaveLength(1);
    const catalog = calls[0].catalog;
    expect(catalog.indexOf("Manual de máquina")).toBeLessThan(
      catalog.indexOf("Detergente desinfectante"),
    );
  });

  test("un usuario solo recibe las fichas de sus centros", async () => {
    const { member } = await seed(setup());

    const result = await member.action(api.ai.askFichaQuestion, {
      question: "¿Qué desinfectante usamos?",
    });

    expect(result.catalogSize).toBe(1);
    expect(result.sources.map((s) => s.centerNames)).toEqual([
      ["MDLZ Granollers"],
    ]);
    // The other center's ficha must not appear anywhere in the prompt.
    expect(calls[0].catalog).not.toContain("Detergente desinfectante");
    expect(calls[0].catalog).not.toContain("MDLZ Montornes");
  });

  test("no revela fichas de otros centros aunque pregunten por ellas", async () => {
    const { member, fichaA } = await seed(setup());

    const result = await member.action(api.ai.askFichaQuestion, {
      question: "Hypofoam de Diversey en Montornes, dosis y precio",
    });

    expect(result.sources.map((s) => s._id)).not.toContain(fichaA);
    expect(calls[0].catalog).not.toContain("Hypofoam");
  });

  test("exige iniciar sesión", async () => {
    const t = setup();
    await seed(t);
    await expect(
      t.action(api.ai.askFichaQuestion, { question: "¿Qué hay?" }),
    ).rejects.toThrow(/iniciar sesión/i);
    expect(calls).toHaveLength(0);
  });

  test("rechaza a las cuentas bloqueadas", async () => {
    const t = setup();
    const { memberId } = await seed(t);
    await t.run(async (ctx) => ctx.db.patch(memberId, { blocked: true }));

    await expect(
      t.withIdentity({ subject: memberId }).action(api.ai.askFichaQuestion, {
        question: "¿Qué hay?",
      }),
    ).rejects.toThrow(/bloqueada/i);
    expect(calls).toHaveLength(0);
  });

  test("no llama a la IA si la pregunta está vacía", async () => {
    const { admin } = await seed(setup());
    await expect(
      admin.action(api.ai.askFichaQuestion, { question: "   " }),
    ).rejects.toThrow(/pregunta/i);
    expect(calls).toHaveLength(0);
  });

  test("avisa sin llamar a la IA cuando el usuario no ve ninguna ficha", async () => {
    const t = setup();
    const lonelyId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "solo@example.com",
        role: "user",
        workCenterIds: [],
      }),
    );

    const result = await t
      .withIdentity({ subject: lonelyId })
      .action(api.ai.askFichaQuestion, { question: "¿Qué hay?" });

    expect(result.catalogSize).toBe(0);
    expect(result.sources).toEqual([]);
    expect(result.answer).toMatch(/administrador/i);
    expect(calls).toHaveLength(0);
  });

  test("propaga el error de la IA para que la interfaz lo muestre", async () => {
    const { admin } = await seed(setup());
    __setFailure(new Error("El asistente necesita la clave de la IA."));

    await expect(
      admin.action(api.ai.askFichaQuestion, { question: "¿Qué hay?" }),
    ).rejects.toThrow(/clave de la IA/);
  });

  test("las fichas inactivas no llegan al modelo", async () => {
    const { admin, fichaA } = await seed(setup());
    await admin.mutation(api.fichas.update, {
      fichaId: fichaA,
      active: false,
    });

    const result = await admin.action(api.ai.askFichaQuestion, {
      question: "¿Qué descontinfectante usamos?",
    });

    expect(result.catalogSize).toBe(1);
    expect(calls[0].catalog).not.toContain("Detergente desinfectante");
  });
});
