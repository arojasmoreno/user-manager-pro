import {
  AiNotConfiguredError,
  DEFAULT_GATEWAY_MODEL,
  DEFAULT_GOOGLE_MODEL,
  answerFromContext,
  answerLanguageFor,
  resolveProvider,
  translateFields,
} from "@/convex/aiClient";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * El cliente de IA se prueba contra un `fetch` simulado: fija el contrato con
 * la API (URL, modelo, forma del prompt, errores) sin salir a la red ni
 * necesitar una clave real. La pasarela de la plataforma se sustituye por un
 * doble para poder comprobar el camino alternativo.
 */
type FetchArgs = [string, { method: string; headers: Record<string, string>; body: string }];

const completion = vi.hoisted(() => ({
  result: {
    success: true,
    data: { choices: [{ message: { content: "  Respuesta de la pasarela.  " } }] },
  } as { success: boolean; data?: unknown; error?: string },
  calls: [] as unknown[],
}));

vi.mock("@vly-ai/integrations", () => ({
  createVlyIntegrations: () => ({
    ai: {
      completion: async (request: unknown) => {
        completion.calls.push(request);
        return completion.result;
      },
    },
  }),
}));

const okResponse = (text: string) => ({
  ok: true,
  json: async () => ({
    candidates: [{ content: { parts: [{ text }] } }],
  }),
  text: async () => "",
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => okResponse("  Respuesta del modelo.  "));
  vi.stubGlobal("fetch", fetchMock);
  completion.calls.length = 0;
  completion.result = {
    success: true,
    data: { choices: [{ message: { content: "  Respuesta de la pasarela.  " } }] },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function ask(language?: { code: string; name: string }) {
  return await answerFromContext({
    question: "¿Qué desinfectante usamos?",
    catalog: 'CATÁLOGO DE FICHAS\n[1] "Detergente desinfectante"',
    language,
  });
}

function lastCall(): FetchArgs {
  const calls = fetchMock.mock.calls as unknown as FetchArgs[];
  return calls[calls.length - 1];
}

describe("resolveProvider: qué clave usa el servidor", () => {
  test("usa Google cuando hay GOOGLE_API_KEY", () => {
    expect(resolveProvider({ GOOGLE_API_KEY: "  clave  " })).toEqual({
      kind: "google",
      key: "clave",
      model: DEFAULT_GOOGLE_MODEL,
    });
  });

  test("acepta GEMINI_API_KEY como nombre alternativo", () => {
    expect(resolveProvider({ GOOGLE_API_KEY: "", GEMINI_API_KEY: "otra" })).toEqual({
      kind: "google",
      key: "otra",
      model: DEFAULT_GOOGLE_MODEL,
    });
  });

  test("permite cambiar el modelo con GOOGLE_MODEL", () => {
    expect(
      resolveProvider({ GOOGLE_API_KEY: "clave", GOOGLE_MODEL: "gemini-3.5-flash-lite" })
        .model,
    ).toBe("gemini-3.5-flash-lite");
  });

  test("sin clave de Google usa la pasarela de la plataforma", () => {
    expect(resolveProvider({ VLY_INTEGRATION_KEY: "sk_prueba" })).toEqual({
      kind: "gateway",
      key: "sk_prueba",
      model: DEFAULT_GATEWAY_MODEL,
    });
  });

  test("sin ninguna clave avisa de lo que falta", () => {
    expect(() => resolveProvider({})).toThrow(AiNotConfiguredError);
    expect(() => resolveProvider({})).toThrow(/GOOGLE_API_KEY/);
    expect(() => resolveProvider({})).toThrow(/VLY_INTEGRATION_KEY/);
  });
});

describe("answerFromContext: sin clave", () => {
  test("avisa con un error claro y no llama a la IA", async () => {
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("VLY_INTEGRATION_KEY", "");
    await expect(ask()).rejects.toBeInstanceOf(AiNotConfiguredError);
    await expect(ask()).rejects.toThrow(/GOOGLE_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(completion.calls).toHaveLength(0);
  });
});

describe("answerFromContext: con clave de Google", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_API_KEY", "clave-de-prueba");
    vi.stubEnv("VLY_INTEGRATION_KEY", "");
  });

  test("llama al modelo vigente pasando la clave", async () => {
    await ask();
    const [url] = lastCall();
    expect(url).toContain("generativelanguage.googleapis.com");
    // Gemini 2.0 está apagado: el modelo por defecto debe ser uno servido hoy.
    expect(url).toContain(`${DEFAULT_GOOGLE_MODEL}:generateContent`);
    expect(url).not.toContain("gemini-2.0-flash");
    expect(url).toContain("key=clave-de-prueba");
  });

  test("envía el catálogo y la pregunta, y exige responder en español", async () => {
    await ask();
    const [, init] = lastCall();
    const body = JSON.parse(init.body);

    expect(body.systemInstruction.parts[0].text).toMatch(/SIEMPRE en español/);
    expect(body.contents[0].parts[0].text).toContain("CATÁLOGO DE FICHAS");
    expect(body.contents[0].parts[0].text).toContain(
      "Detergente desinfectante",
    );
    expect(body.contents[0].parts[0].text).toContain(
      "¿Qué desinfectante usamos?",
    );
    // Las respuestas no pueden inventarse datos del catálogo.
    expect(body.systemInstruction.parts[0].text).toMatch(/No inventes/);
    expect(body.generationConfig.temperature).toBe(0.2);
  });

  test("responde en el idioma de la persona que pregunta", async () => {
    await ask({ code: "fr-FR", name: "Français" });
    const [, init] = lastCall();
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toContain(
      "SIEMPRE en Français (fr-FR)",
    );
  });

  test("devuelve el texto de la respuesta sin espacios sobrantes", async () => {
    await expect(ask()).resolves.toBe("Respuesta del modelo.");
  });

  test("propaga el error de la API cuando la llamada falla", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "quota exceeded",
    });
    await expect(ask()).rejects.toThrow(/429/);
  });

  test("avisa cuando el modelo no devuelve texto", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [] } }] }),
      text: async () => "",
    });
    await expect(ask()).rejects.toThrow(/no devolvió ninguna respuesta/i);
  });
});

describe("answerFromContext: con la pasarela de la plataforma", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("VLY_INTEGRATION_KEY", "sk_prueba");
  });

  test("responde a través de la pasarela, sin llamar a Google", async () => {
    await expect(ask()).resolves.toBe("Respuesta de la pasarela.");
    expect(fetchMock).not.toHaveBeenCalled();

    const request = completion.calls[0] as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(request.model).toBe(DEFAULT_GATEWAY_MODEL);
    expect(request.messages[0].role).toBe("system");
    expect(request.messages[1].content).toContain("Detergente desinfectante");
  });

  test("traduce el error de la pasarela a un aviso legible", async () => {
    completion.result = { success: false, error: "model not found" };
    await expect(ask()).rejects.toThrow(/pasarela de IA.*model not found/s);
  });
});

describe("answerLanguageFor", () => {
  test("el español (idioma de las fichas) es el comportamiento por defecto", () => {
    expect(answerLanguageFor("es-ES")).toBeUndefined();
    expect(answerLanguageFor(undefined)).toBeUndefined();
  });

  test("un idioma desconocido no cambia el idioma de respuesta", () => {
    expect(answerLanguageFor("de-DE")).toBeUndefined();
  });

  test("los idiomas pedidos se traducen a su nombre para el modelo", () => {
    expect(answerLanguageFor("fr-FR")).toEqual({
      code: "fr-FR",
      name: "Français",
    });
    expect(answerLanguageFor("mnk")).toEqual({ code: "mnk", name: "Mandinka" });
  });
});

describe("translateFields", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_API_KEY", "clave-de-prueba");
  });

  const reply = (text: string) =>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
      text: async () => "",
    });

  test("exige JSON y conserva los campos traducidos", async () => {
    reply(
      '{"title":"Détergent désinfectant","productName":"Hypofoam","manufacturer":""}',
    );
    const result = await translateFields({
      fields: { title: "Detergente desinfectante", productName: "Hypofoam" },
      targetLocale: "fr-FR",
      targetName: "Français",
    });

    expect(result).toEqual({
      title: "Détergent désinfectant",
      productName: "Hypofoam",
      manufacturer: undefined,
    });
  });

  test("tolera el JSON envuelto en un bloque de código", async () => {
    reply('```json\n{"title":"Disinfectant detergent"}\n```');
    const result = await translateFields({
      fields: { title: "Detergente desinfectante" },
      targetLocale: "en-GB",
      targetName: "English",
    });
    expect(result.title).toBe("Disinfectant detergent");
  });

  test("falla con un aviso claro si el JSON es inválido", async () => {
    reply("Lo siento, no puedo traducirlo.");
    await expect(
      translateFields({
        fields: { title: "Detergente" },
        targetLocale: "mnk",
        targetName: "Mandinka",
      }),
    ).rejects.toThrow(/formato válido/);
  });

  test("falla si el modelo no devuelve el título", async () => {
    reply('{"productName":"Hypofoam"}');
    await expect(
      translateFields({
        fields: { title: "Detergente" },
        targetLocale: "ar-MA",
        targetName: "العربية",
      }),
    ).rejects.toThrow(/título traducido/);
  });

  test("nombra el modelo en el error cuando la API falla", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "model not found",
    });
    await expect(
      translateFields({
        fields: { title: "Detergente" },
        targetLocale: "fr-FR",
        targetName: "Français",
      }),
    ).rejects.toThrow(/gemini-3\.8-flash.*404/);
  });
});
