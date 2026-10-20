/**
 * Interruptores de funcionalidad.
 *
 * El asistente responde con la IA del deployment (Google AI Studio o la
 * pasarela de integración; ver `src/convex/aiClient.ts`). Está activo: si la
 * clave todavía no está puesta, la propia pantalla lo explica en lugar de
 * quedarse en blanco, así que no hace falta esconder la pestaña.
 */
export const ASSISTANT_ENABLED = true;

/**
 * Traducción de fichas a los otros idiomas de la aplicación.
 *
 * Sigue implementada por completo (consultas, panel de edición y acción de IA),
 * pero queda apagada mientras la clave de IA del deployment no tenga cuota que
 * la soporte: sin ella cada «Traducir» devolvía un 429 y el administrador solo
 * veía errores. Para volver a activarla basta con poner este interruptor a
 * `true` y republicar; no hace falta tocar nada más.
 *
 * Con ella apagada no se pide ninguna traducción al servidor y todas las fichas
 * se muestran en su idioma original (español), sin avisos de «Sin traducir».
 */
export const TRANSLATIONS_ENABLED = false;
