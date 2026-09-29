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
