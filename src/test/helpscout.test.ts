import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createConversation,
  customerFirstName,
  fetchAccessToken,
  HelpScoutNotConfiguredError,
  readCredentials,
  type Credentials,
} from "@/convex/helpscout";

/**
 * The Help Scout client is exercised against a stubbed `fetch`, so the OAuth
 * exchange and the conversation payload are verified without credentials and
 * without hitting the real API.
 */
const ENV = {
  HELPSCOUT_CLIENT_ID: "client-id",
  HELPSCOUT_CLIENT_SECRET: "client-secret",
  HELPSCOUT_MAILBOX_ID: "85",
};

const CREDENTIALS: Credentials = {
  clientId: "client-id",
  clientSecret: "client-secret",
  mailboxId: 85,
};

const PAYLOAD = {
  subject: "La ficha no se descarga",
  body: "Al abrir el PDF sale un error.",
  customerEmail: "antonio@example.com",
  customerName: "Antonio Rojas Moreno",
};

type Call = [string, { method: string; headers: Record<string, string>; body: unknown }];

let fetchMock: ReturnType<typeof vi.fn>;

function tokenResponse() {
  return {
    ok: true,
    json: async () => ({ access_token: "token-abc", expires_in: 172800 }),
    text: async () => "",
  };
}

function conversationResponse() {
  return {
    ok: true,
    json: async () => ({ id: 123, subject: PAYLOAD.subject }),
    text: async () => "",
  };
}

beforeEach(() => {
  fetchMock = vi.fn(async () => tokenResponse());
  vi.stubGlobal("fetch", fetchMock);
});

function calls(): Call[] {
  return fetchMock.mock.calls as unknown as Call[];
}

describe("lectura de credenciales", () => {
  test("acepta las tres variables", () => {
    expect(readCredentials(ENV)).toEqual(CREDENTIALS);
  });

  test("avisa cuando falta cualquiera de las tres", () => {
    for (const key of Object.keys(ENV)) {
      const partial: Record<string, string | undefined> = { ...ENV };
      delete partial[key];
      expect(() => readCredentials(partial), key).toThrow(
        HelpScoutNotConfiguredError,
      );
    }
  });

  test("rechaza un identificador de bandeja que no es un número", () => {
    expect(() =>
      readCredentials({ ...ENV, HELPSCOUT_MAILBOX_ID: "no-es-un-número" }),
    ).toThrow(HelpScoutNotConfiguredError);
    expect(() =>
      readCredentials({ ...ENV, HELPSCOUT_MAILBOX_ID: "" }),
    ).toThrow(HelpScoutNotConfiguredError);
  });
});

describe("nombre del cliente", () => {
  test("usa el primer nombre y respects el límite de 40 caracteres", () => {
    expect(customerFirstName("Antonio Rojas Moreno")).toBe("Antonio");
    expect(customerFirstName("  Ana  ")).toBe("Ana");
    expect(customerFirstName("a".repeat(80))).toHaveLength(40);
    expect(customerFirstName(undefined)).toBeUndefined();
    expect(customerFirstName("   ")).toBeUndefined();
  });
});

describe("obtención del token", () => {
  test("usa el flujo de credenciales de cliente", async () => {
    await expect(
      fetchAccessToken(CREDENTIALS, fetchMock as unknown as typeof fetch),
    ).resolves.toBe("token-abc");

    const [url, init] = calls()[0];
    expect(url).toBe("https://api.helpscout.net/v2/oauth2/token");
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("client-id");
    expect(body.get("client_secret")).toBe("client-secret");
  });

  test("propaga el rechazo de credenciales", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "invalid client",
    });
    await expect(
      fetchAccessToken(CREDENTIALS, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/401/);
  });

  test("avisa si la respuesta no trae token", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
      text: async () => "",
    });
    await expect(
      fetchAccessToken(CREDENTIALS, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/token de acceso/i);
  });
});

describe("creación de la conversación", () => {
  test("crea la conversación con el cliente y el texto correctos", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(conversationResponse());

    const result = await createConversation(
      PAYLOAD,
      CREDENTIALS,
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ conversationId: 123 });
    const [url, init] = calls()[1];
    expect(url).toBe("https://api.helpscout.net/v2/conversations");
    expect(init.headers.Authorization).toBe("Bearer token-abc");

    const body = JSON.parse(init.body as string);
    expect(body.subject).toBe(PAYLOAD.subject);
    expect(body.mailboxId).toBe(85);
    expect(body.type).toBe("email");
    expect(body.status).toBe("active");
    expect(body.customer).toEqual({
      email: "antonio@example.com",
      firstName: "Antonio",
    });
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].type).toBe("customer");
    expect(body.threads[0].text).toContain(PAYLOAD.body);
    expect(body.tags).toContain("doc-manager");
  });

  test("añade el contexto de la ficha al final del mensaje", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(conversationResponse());

    await createConversation(
      { ...PAYLOAD, context: "Ficha: Detergente desinfectante" },
      CREDENTIALS,
      fetchMock as unknown as typeof fetch,
    );

    const body = JSON.parse(calls()[1][1].body as string);
    expect(body.threads[0].text).toContain("Ficha: Detergente desinfectante");
  });

  test("propaga el error cuando la bandeja rechaza la conversación", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => "mailbox not found",
      });

    await expect(
      createConversation(PAYLOAD, CREDENTIALS, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/422/);
  });

  test("no revienta si la respuesta 201 no trae cuerpo", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("sin cuerpo");
        },
        text: async () => "",
      });

    await expect(
      createConversation(PAYLOAD, CREDENTIALS, fetchMock as unknown as typeof fetch),
    ).resolves.toEqual({ conversationId: null });
  });
});
