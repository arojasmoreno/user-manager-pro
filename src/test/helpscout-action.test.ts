import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";

/**
 * The action is exercised end to end with only the outbound HTTP call faked,
 * so the session check, the input validation and the Help Scout payload all run
 * exactly as in production.
 */
const modules = {
  "_generated/server": () => import("@/convex/_generated/server"),
  schema: () => import("@/convex/schema"),
  access: () => import("@/convex/access"),
  helpscout: () => import("@/convex/helpscout"),
};

type T = ReturnType<typeof setup>;

function setup() {
  return convexTest(schema, modules);
}

async function seed(t: T) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "antonio@example.com",
      name: "Antonio Rojas Moreno",
      role: "user",
    }),
  );
  return { userId, session: t.withIdentity({ subject: userId }) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.HELPSCOUT_CLIENT_ID = "client-id";
  process.env.HELPSCOUT_CLIENT_SECRET = "client-secret";
  process.env.HELPSCOUT_MAILBOX_ID = "85";
  fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes("oauth2/token")) {
      return {
        ok: true,
        json: async (): Promise<unknown> => ({ access_token: "token-abc" }),
        text: async (): Promise<string> => "",
      };
    }
    return {
      ok: true,
      json: async (): Promise<unknown> => ({ id: 123 }),
      text: async (): Promise<string> => "",
    };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.HELPSCOUT_CLIENT_ID;
  delete process.env.HELPSCOUT_CLIENT_SECRET;
  delete process.env.HELPSCOUT_MAILBOX_ID;
});

describe("helpscout.sendSupportRequest", () => {
  test("abre la conversación con los datos del usuario conectado", async () => {
    const { session } = await seed(setup());
    const result = await session.action(api.helpscout.sendSupportRequest, {
      subject: "La ficha no se descarga",
      body: "Al abrir el PDF sale un error.",
    });

    expect(result).toEqual({ conversationId: 123 });
    const createCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).endsWith("/conversations"),
    );
    const body = JSON.parse((createCall?.[1] as RequestInit).body as string);
    expect(body.customer.email).toBe("antonio@example.com");
    expect(body.customer.firstName).toBe("Antonio");
    expect(body.subject).toBe("La ficha no se descarga");
  });

  test("exige iniciar sesión y no llama a la API", async () => {
    const t = setup();
    await seed(t);
    await expect(
      t.action(api.helpscout.sendSupportRequest, {
        subject: "Hola",
        body: "Mundo",
      }),
    ).rejects.toThrow(/iniciar sesión/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rechaza un asunto o un cuerpo vacíos sin llamar a la API", async () => {
    const { session } = await seed(setup());
    await expect(
      session.action(api.helpscout.sendSupportRequest, {
        subject: "   ",
        body: "Algo",
      }),
    ).rejects.toThrow(/asunto y un mensaje/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rechaza un mensaje demasiado largo", async () => {
    const { session } = await seed(setup());
    await expect(
      session.action(api.helpscout.sendSupportRequest, {
        subject: "Hola",
        body: "a".repeat(4001),
      }),
    ).rejects.toThrow(/4000 caracteres/i);
  });

  test("avisa de que falta la configuración sin llamar a la API", async () => {
    delete process.env.HELPSCOUT_MAILBOX_ID;
    const { session } = await seed(setup());
    await expect(
      session.action(api.helpscout.sendSupportRequest, {
        subject: "Hola",
        body: "Mundo",
      }),
    ).rejects.toThrow(/HELPSCOUT_MAILBOX_ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("no deja enviar si la cuenta no tiene correo", async () => {
    const t = setup();
    const noEmailId = await t.run(async (ctx) =>
      ctx.db.insert("users", { role: "user" }),
    );
    await expect(
      t.withIdentity({ subject: noEmailId }).action(
        api.helpscout.sendSupportRequest,
        { subject: "Hola", body: "Mundo" },
      ),
    ).rejects.toThrow(/correo electrónico/i);
  });
});
