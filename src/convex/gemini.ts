"use node";

/**
 * Thin client for the Google AI Studio (Gemini) REST API.
 *
 * The key is read from the Convex deployment environment, never from the
 * browser. The assistant sends the ficha's catalog text to the model, so a
 * single key and a single model are enough — no embedding service needed.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const CHAT_MODEL = "gemini-2.0-flash";

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "El asistente necesita la clave de la IA. Añádela en la pestaña Keys como GOOGLE_API_KEY.",
    );
    this.name = "AiNotConfiguredError";
  }
}

function apiKey(): string {
  const key = process.env.GOOGLE_API_KEY?.trim();
  if (!key) throw new AiNotConfiguredError();
  return key;
}

type TranslateableFields = {
  title: string;
  productName?: string;
  manufacturer?: string;
};

/**
 * Translates the writable fields of a ficha into `targetLocale`.
 *
 * The model is asked for strict JSON and its answer is validated here, so a
 * malformed or truncated reply fails loudly instead of storing half a
 * translation.
 */
export async function translateFields(params: {
  fields: TranslateableFields;
  targetLocale: string;
  targetName: string;
}): Promise<TranslateableFields> {
  const { title, productName, manufacturer } = params.fields;
  const instruction =
    `Traduce los valores de un catálogo de fichas de seguridad al idioma ` +
    `«${params.targetName}» (${params.targetLocale}).\n` +
    "Reglas:\n" +
    "1. Respeta exactamente el formato de salida: un único objeto JSON.\n" +
    "2. Traduce los valores, no las claves.\n" +
    "3. Si un campo está vacío, devuélvelo como cadena vacía.\n" +
    "4. Conserva los nombres propios, las marcas, los modelos y las " +
    "referencias técnicas sin traducir.\n" +
    '5. Devuelve solo JSON con esta forma: {"title":"...","productName":"...",' +
    '"manufacturer":"..."}';

  const payload: Record<string, string> = { title };
  if (productName) payload.productName = productName;
  if (manufacturer) payload.manufacturer = manufacturer;

  const res = await fetch(
    `${API_BASE}/models/${CHAT_MODEL}:generateContent?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(payload) }],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 600 },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `La API de IA respondió ${res.status}. ${detail.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) {
    throw new Error("La IA no devolvió ninguna traducción.");
  }

  // Tolerate a fenced code block around the JSON.
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("La IA no devolvió una traducción en formato válido.");
  }

  const result = parsed as Record<string, unknown>;
  if (typeof result.title !== "string" || result.title.trim() === "") {
    throw new Error("La IA no devolvió el título traducido.");
  }

  const clean = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  return {
    title: result.title.trim(),
    productName: clean(result.productName),
    manufacturer: clean(result.manufacturer),
  };
}

/** Asks Gemini to answer using only the supplied catalog context. */
export async function answerFromContext(params: {
  question: string;
  catalog: string;
}): Promise<string> {
  const systemInstruction =
    "Eres el asistente documental de Doc Manager. Respondes SIEMPRE en español, " +
    "de forma breve y práctica, para personal que consulta fichas en el trabajo.\n" +
    "Reglas:\n" +
    "1. Usa ÚNICAMENTE la información del catálogo que se te entrega.\n" +
    "2. Si el catálogo no contiene la respuesta, dilo claramente y sugiere revisar el " +
    "catálogo o contactar con el administrador. No inventes datos.\n" +
    "3. Cuando menciones una ficha, escribe su título exacto entre comillas.\n" +
    "4. No inventes precios, fechas, dosis ni medidas que no aparezcan en el catálogo.\n" +
    "5. Cierra la respuesta indicando qué fichas ha usado, por su número ([1], [2]…).";

  const res = await fetch(
    `${API_BASE}/models/${CHAT_MODEL}:generateContent?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `CATÁLOGO DE FICHAS\n${params.catalog}\n\nPREGUNTA DEL USUARIO\n${params.question}`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `La API de IA respondió ${res.status}. ${detail.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("La IA no devolvió ninguna respuesta.");
  }
  return text;
}
