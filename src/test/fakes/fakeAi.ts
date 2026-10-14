/**
 * Doble de `src/convex/aiClient.ts` para los tests de la acción del asistente.
 *
 * Registra cada llamada para que un test pueda comprobar el catálogo exacto que
 * habría recibido el modelo, y responde con un texto fijo.
 */
import { ConvexError } from "convex/values";
import { LOCALES } from "@/i18n/locales";

export type FakeAnswerCall = {
  question: string;
  catalog: string;
  language?: { code: string; name: string };
};

export const calls: FakeAnswerCall[] = [];

export const AiNotConfiguredError = class extends Error {
  constructor() {
    super("El asistente necesita la clave de la IA.");
  }
};

let reply = "Respuesta de prueba [1].";
let failure: Error | null = null;

export function __reset() {
  calls.length = 0;
  reply = "Respuesta de prueba [1].";
  failure = null;
}

export function __setReply(text: string) {
  reply = text;
}

export function __setFailure(error: Error | null) {
  failure = error;
}

/**
 * Espejo de `userFacingAiError`: la acción real convierte cualquier fallo de la
 * IA en un `ConvexError`, que es el único cuyo mensaje no redacta Convex.
 */
export function userFacingAiError(err: unknown): ConvexError<string> {
  const message =
    err instanceof Error && err.message.trim() !== ""
      ? err.message.trim()
      : "La IA no ha podido responder.";
  return new ConvexError(message.slice(0, 500));
}

/**
 * Espejo de `answerLanguageFor`: el idioma de respuesta se decide en el cliente
 * real, así que aquí basta con reproducir su regla (sin idioma o español →
 * `undefined`, que es la respuesta por defecto).
 */
export function answerLanguageFor(
  locale: string | undefined,
): { code: string; name: string } | undefined {
  const meta = LOCALES.find((l) => l.code === locale);
  if (!meta || meta.code === "es-ES") return undefined;
  return { code: meta.code, name: meta.short };
}

export async function answerFromContext(params: {
  question: string;
  catalog: string;
  language?: { code: string; name: string };
}): Promise<string> {
  calls.push(params);
  if (failure) throw failure;
  return reply;
}
