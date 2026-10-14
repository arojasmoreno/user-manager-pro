/**
 * Interruptores de funcionalidad.
 *
 * El asistente responde con la IA del deployment (Google AI Studio o la
 * pasarela de integración; ver `src/convex/aiClient.ts`). Está activo: si la
 * clave todavía no está puesta, la propia pantalla lo explica en lugar de
 * quedarse en blanco, así que no hace falta esconder la pestaña.
 */
export const ASSISTANT_ENABLED = true;
