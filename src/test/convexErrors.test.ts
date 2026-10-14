import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { errorText } from "@/lib/convexErrors";

const FALLBACK = "No se ha podido completar la operación.";

describe("errorText", () => {
  test("usa el mensaje que viaja dentro de un ConvexError", () => {
    expect(errorText(new ConvexError("Falta la clave de la IA."), FALLBACK)).toBe(
      "Falta la clave de la IA.",
    );
  });

  test("lee el mensaje de un ConvexError con datos estructurados", () => {
    expect(
      errorText(new ConvexError({ message: "Idioma no admitido." }), FALLBACK),
    ).toBe("Idioma no admitido.");
  });

  test("quita el preludio que añade el cliente de Convex", () => {
    const err = new Error(
      "[CONVEX A(ai:askFichaQuestion)] Escribe una pregunta antes de enviar.\n  Called by client",
    );
    expect(errorText(err, FALLBACK)).toBe(
      "Escribe una pregunta antes de enviar.",
    );
  });

  test("cae al texto por defecto cuando Convex ha redactado el error", () => {
    const withCalledByClient = new Error(
      "[CONVEX A(ai:askFichaQuestion)] [Request ID: 984ccb16fa2276ab] Server Error Called by client\n  Called by client",
    );
    expect(errorText(withCalledByClient, FALLBACK)).toBe(FALLBACK);

    // Según la versión, el marcador llega sin la coletilla «Called by client».
    const short = new Error(
      "[CONVEX A(ai:askFichaQuestion)] [Request ID: 5ff1e7ac7e6be701] Server Error\n  Called by client",
    );
    expect(errorText(short, FALLBACK)).toBe(FALLBACK);

    // Un error de servidor sin mensaje propio tampoco debe filtrar el ruido.
    expect(errorText(new Error("[Request ID: abc] Server Error"), FALLBACK)).toBe(
      FALLBACK,
    );
  });

  test("conserva el mensaje real aunque venga con el preludio de Convex", () => {
    const err = new Error(
      "[CONVEX A(traduccionesAi:translateFicha)] Google AI (gemini-3.8-flash) respondió 404.\n  Called by client",
    );
    expect(errorText(err, FALLBACK)).toBe(
      "Google AI (gemini-3.8-flash) respondió 404.",
    );
  });

  test("cae al texto por defecto con datos vacíos o sin error", () => {
    expect(errorText(new ConvexError("   "), FALLBACK)).toBe(FALLBACK);
    expect(errorText(new ConvexError({}), FALLBACK)).toBe(FALLBACK);
    expect(errorText(undefined, FALLBACK)).toBe(FALLBACK);
    expect(errorText("vaya", FALLBACK)).toBe(FALLBACK);
  });
});
