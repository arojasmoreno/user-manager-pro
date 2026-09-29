/**
 * Stand-in for `src/convex/gemini.ts` used by the chatbot action tests.
 *
 * It records every call so a test can assert on the exact catalog text the
 * model would have received, and answers with a canned reply.
 */
export const calls: { question: string; catalog: string }[] = [];

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

export async function answerFromContext(params: {
  question: string;
  catalog: string;
}): Promise<string> {
  calls.push(params);
  if (failure) throw failure;
  return reply;
}
