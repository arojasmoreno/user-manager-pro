import {
  answerFromContext,
  AiNotConfiguredError,
} from "@/convex/gemini";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The Gemini client is exercised against a stubbed `fetch`: this pins the
 * contract with the API (url, model, prompt shape, error handling) without ever
 * calling out or needing a real key.
 */
type FetchArgs = [string, { method: string; headers: Record<string, string>; body: string }];

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
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function ask() {
  return await answerFromContext({
    question: "¿Qué descontinfectante usamos?",
    catalog: "CATÁLOGO DE FICHAS\n[1] \"Detergente desinfectante\"",
  });
}

function lastCall(): FetchArgs {
  const calls = fetchMock.mock.calls as unknown as FetchArgs[];
  return calls[calls.length - 1];
}

describe("gemini.answerFromContext: sin clave", () => {
  test("avisa con un error claro y no llama a la API", async () => {
    vi.stubEnv("GOOGLE_API_KEY", "");
    await expect(ask()).rejects.toBeInstanceOf(AiNotConfiguredError);
    await expect(ask()).rejects.toThrow(/GOOGLE_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("gemini.answerFromContext: con clave", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_API_KEY", "clave-de-prueba");
  });

  test("llama al modelo correcto pasando la clave", async () => {
    await ask();
    const [url] = lastCall();
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("gemini-2.0-flash:generateContent");
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
      "¿Qué descontinfectante usamos?",
    );
    // Answers must not invent catalog data.
    expect(body.systemInstruction.parts[0].text).toMatch(/No inventes/);
    expect(body.generationConfig.temperature).toBe(0.2);
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
