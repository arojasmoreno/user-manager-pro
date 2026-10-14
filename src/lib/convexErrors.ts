import { ConvexError } from "convex/values";

/**
 * Texto que se le puede enseñar a quien usa la aplicación a partir de un error
 * recibido de Convex.
 *
 * Convex solo conserva el mensaje de los errores que son `ConvexError`, que
 * viajan en `error.data`. Cualquier otro se registra en el servidor y el
 * navegador recibe un genérico «Server Error Called by client»: sin esta
 * traducción, un problema tan accionable como «falta la clave de la IA» acaba
 * mostrándose como un error opaco.
 */
export function errorText(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const data = err.data;
    if (typeof data === "string" && data.trim() !== "") return data.trim();
    if (
      data !== null &&
      typeof data === "object" &&
      typeof (data as { message?: unknown }).message === "string" &&
      (data as { message: string }).message.trim() !== ""
    ) {
      return (data as { message: string }).message.trim();
    }
    return fallback;
  }

  const raw = err instanceof Error ? err.message : "";
  // El cliente de Convex añade ruido alrededor del mensaje real: el preludio
  // `[CONVEX A(módulo:función)]`, el `[Request ID: …]` y el cierre
  // `Called by client`. Nada de eso ayuda a quien lee.
  const cleaned = raw
    .replace(/\[CONVEX [^\]]*\]\s*/g, "")
    .replace(/\[Request ID: [^\]]*\]\s*/gi, "")
    .replace(/\s*Called by client\s*$/i, "")
    .trim();

  // Cuando Convex redacta el fallo no queda mensaje propio: solo el marcador
  // genérico, en sus dos redacciones posibles.
  if (cleaned === "" || /^server error( called by client)?$/i.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}
