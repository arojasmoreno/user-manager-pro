"use node";

/**
 * Cliente de IA del asistente documental y de la traducción de fichas.
 *
 * Se configura desde el entorno del deployment de Convex, con dos caminos
 * equivalentes (el primero que exista, gana):
 *
 * 1. `GOOGLE_API_KEY` — clave de Google AI Studio. Se llama a Gemini
 *    directamente, sin intermediarios. Modelo: `GOOGLE_MODEL`.
 * 2. `VLY_INTEGRATION_KEY` — clave de integración de la plataforma. Se llama a
 *    la pasarela de IA, que da acceso a cualquier modelo sin abrir una cuenta
 *    nueva. Modelo: `VLY_AI_MODEL`.
 *
 * La traducción de fichas va antes por la API Cloud Translation v2
 * (`apis/Google.Cloud.Translation.V2`, con `GOOGLE_TRANSLATE_API_KEY`); los
 * modelos anteriores responden al asistente y sirven de respaldo cuando la API
 * de traducción no puede atender una petición.
 *
 * Las claves se leen siempre aquí, en el servidor: nunca viajan al navegador.
 */

import { ConvexError } from "convex/values";
import { createVlyIntegrations } from "@vly-ai/integrations";
import { LOCALES, SOURCE_LOCALE } from "../i18n/locales";

const GOOGLE_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Modelos por defecto. Gemini 2.0 (el que se usaba antes) está apagado desde
 * 2025 y respondía 404, así que se usa el Flash estable actual.
 * Ambos modelos se pueden cambiar con GOOGLE_MODEL y VLY_AI_MODEL.
 */
export const DEFAULT_GOOGLE_MODEL = "gemini-3.8-flash";
export const DEFAULT_GATEWAY_MODEL = "google/gemini-3.8-flash";

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "Falta la clave de la IA. Añade GOOGLE_API_KEY (Google AI Studio) o " +
        "VLY_INTEGRATION_KEY en la pestaña Keys del proyecto, o con " +
        "`npx convex env set GOOGLE_API_KEY <clave>`, y vuelve a intentarlo.",
    );
    this.name = "AiNotConfiguredError";
  }
}

/**
 * Convierte un fallo del cliente de IA en un error que el navegador sí puede
 * leer.
 *
 * Convex solo envía al cliente el mensaje de los `ConvexError`; el resto se
 * registra en el servidor y el navegador recibe un genérico «Server Error
 * Called by client». De ahí que un problema tan accionable como «falta la clave
 * de la IA» llegase a la interfaz como un error opaco.
 */
export function userFacingAiError(err: unknown): ConvexError<string> {
  const message =
    err instanceof Error && err.message.trim() !== ""
      ? err.message.trim()
      : "La IA no ha podido responder.";
  return new ConvexError(message.slice(0, 500));
}

export type AiProvider = {
  /** `google` llama a Gemini; `gateway`, a la pasarela de la plataforma. */
  kind: "google" | "gateway";
  key: string;
  model: string;
};

/**
 * Decide con qué proveedor se habla. Aislado de la red para poder probarlo: el
 * primer camino configurado gana y, sin ninguno, se explica qué falta.
 */
export function resolveProvider(
  env: Record<string, string | undefined> = process.env,
): AiProvider {
  const google =
    env.GOOGLE_API_KEY?.trim() || env.GEMINI_API_KEY?.trim() || "";
  if (google) {
    return {
      kind: "google",
      key: google,
      model: env.GOOGLE_MODEL?.trim() || DEFAULT_GOOGLE_MODEL,
    };
  }

  const gateway = env.VLY_INTEGRATION_KEY?.trim();
  if (gateway) {
    return {
      kind: "gateway",
      key: gateway,
      model: env.VLY_AI_MODEL?.trim() || DEFAULT_GATEWAY_MODEL,
    };
  }

  throw new AiNotConfiguredError();
}

/** Cómo se llama el proveedor en un mensaje de error, con su modelo. */
export function describeProvider(provider: AiProvider): string {
  return provider.kind === "google"
    ? `Google AI (${provider.model})`
    : `la pasarela de IA (${provider.model})`;
}

type CompletionRequest = {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
};

/**
 * Una respuesta de texto del modelo. Los dos proveedores se normalizan aquí,
 * así que el resto del código no sabe (ni le importa) quién responde.
 */
async function complete(
  provider: AiProvider,
  request: CompletionRequest,
): Promise<string> {
  return provider.kind === "google"
    ? await completeWithGoogle(provider, request)
    : await completeWithGateway(provider, request);
}

async function completeWithGoogle(
  provider: AiProvider,
  request: CompletionRequest,
): Promise<string> {
  // La clave viaja en la cabecera que documenta la API de Gemini, no en la URL:
  // una query string acaba en registros de proxies y en mensajes de error.
  const res = await fetch(
    `${GOOGLE_API_BASE}/models/${provider.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": provider.key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: request.user }] }],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // 400/403 suelen ser la propia clave (API_KEY_INVALID): se dice dónde
    // cambiarla en lugar de dejar el detalle crudo de Google como única pista.
    const hint =
      res.status === 400 || res.status === 403
        ? " Revisa GOOGLE_API_KEY en la pestaña Keys del proyecto."
        : "";
    throw new Error(
      `${describeProvider(provider)} respondió ${res.status}. ${detail.slice(0, 300)}${hint}`,
    );
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("La IA no devolvió ninguna respuesta.");
  return text;
}

async function completeWithGateway(
  provider: AiProvider,
  request: CompletionRequest,
): Promise<string> {
  const vly = createVlyIntegrations({
    deploymentToken: provider.key,
    debug: false,
  });

  const result = await vly.ai.completion({
    model: provider.model,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: request.user },
    ],
    temperature: request.temperature,
    maxTokens: request.maxTokens,
  });

  if (!result.success) {
    throw new Error(
      `${describeProvider(provider)} respondió con un error. ${result.error ?? "Sin detalle."}`,
    );
  }

  const text = result.data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("La IA no devolvió ninguna respuesta.");
  return text;
}

type TranslateableFields = {
  title: string;
  productName?: string;
  manufacturer?: string;
};

// ---------------------------------------------------------------------------
// Traducción de fichas — Google Cloud Translation v2
// ---------------------------------------------------------------------------

/** Ruta de Cloud Translation - Basic (v2), «apis/Google.Cloud.Translation.V2». */
const CLOUD_TRANSLATION_URL =
  "https://translation.googleapis.com/language/translate/v2";

/**
 * Clave de Google Cloud con la API Cloud Translation habilitada. Es un producto
 * distinto de Gemini (AI Studio), así que tiene su propia variable: mientras
 * exista, las fichas se traducen con esta API; si no, se usan los modelos del
 * bloque siguiente. La clave se lee solo en el servidor.
 */
export function resolveTranslationKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return env.GOOGLE_TRANSLATE_API_KEY?.trim() || null;
}

/**
 * Locale de la app → código que la v2 reconoce (lista de Language Support).
 * Google no lista en-GB ni ar-MA para el modelo NMT, así que se mandan como
 * idioma base; mnk sí se manda tal cual, y si la API lo rechaza la traducción
 * cae al modelo de IA (el `translateFields` de más abajo).
 */
const CLOUD_LANGUAGE_BY_LOCALE: Record<string, string> = {
  "es-ES": "es",
  "fr-FR": "fr",
  "en-GB": "en",
  "ar-MA": "ar",
  mnk: "mnk",
};

export function cloudTranslationLanguage(locale: string): string {
  return CLOUD_LANGUAGE_BY_LOCALE[locale] ?? locale.split("-")[0] ?? locale;
}

/** La v2 devuelve los textos con los caracteres HTML escapados (&amp;, &#39;…). */
function unescapeHtml(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function translateViaCloudTranslation(params: {
  key: string;
  fields: TranslateableFields;
  targetLocale: string;
}): Promise<TranslateableFields> {
  const { title, productName, manufacturer } = params.fields;
  // Todos los campos van en una sola llamada: `q` acepta hasta 128 textos.
  const entries: {
    field: "title" | "productName" | "manufacturer";
    text: string;
  }[] = [{ field: "title", text: title }];
  if (productName) entries.push({ field: "productName", text: productName });
  if (manufacturer) entries.push({ field: "manufacturer", text: manufacturer });

  // La v2 documenta la clave como parámetro `key` de la URL (la referencia del
  // método no la recoge en cabecera). La petición sale del servidor Convex y
  // solo la ven Google y los registros del propio servidor.
  const res = await fetch(
    `${CLOUD_TRANSLATION_URL}?key=${encodeURIComponent(params.key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: entries.map((entry) => entry.text),
        source: cloudTranslationLanguage(SOURCE_LOCALE),
        target: cloudTranslationLanguage(params.targetLocale),
        format: "text",
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Google Cloud Translation (translate/v2) respondió ${res.status}. ${detail.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as {
    data?: { translations?: { translatedText?: string }[] };
  };
  const translations = data.data?.translations ?? [];
  if (translations.length !== entries.length) {
    throw new Error("Google Cloud Translation no devolvió la traducción completa.");
  }

  const clean = (value: string | undefined): string | undefined => {
    const trimmed = unescapeHtml(value ?? "").trim();
    return trimmed === "" ? undefined : trimmed;
  };
  const translated: {
    title?: string;
    productName?: string;
    manufacturer?: string;
  } = {};
  entries.forEach((entry, index) => {
    translated[entry.field] = clean(translations[index]?.translatedText);
  });
  if (!translated.title) {
    throw new Error("Google Cloud Translation no devolvió el título traducido.");
  }
  return {
    title: translated.title,
    productName: translated.productName,
    manufacturer: translated.manufacturer,
  };
}

/**
 * Traduce los campos editables de una ficha al idioma pedido.
 *
 * Primero usa la API de traducción de Google (v2). Si esta no puede atender la
 * petición —idioma que aún no admite, clave de Google Cloud sin la API
 * habilitada, cuota agotada…— se avisa en el servidor y se recurre al modelo de
 * IA, para que un problema de configuración de la API no deje fichas sin
 * traducir.
 */
export async function translateFields(params: {
  fields: TranslateableFields;
  targetLocale: string;
  targetName: string;
}): Promise<TranslateableFields> {
  const key = resolveTranslationKey();
  let cloudError: string | null = null;
  if (key !== null) {
    try {
      return await translateViaCloudTranslation({
        key,
        fields: params.fields,
        targetLocale: params.targetLocale,
      });
    } catch (err) {
      cloudError =
        err instanceof Error && err.message.trim() !== ""
          ? err.message.trim()
          : "error sin detalle";
      console.warn(
        `Google Cloud Translation no pudo traducir a ${params.targetLocale}; se usa el modelo de IA. ${cloudError}`,
      );
    }
  }

  try {
    return await translateWithModel(params);
  } catch (err) {
    if (cloudError !== null) {
      const modelError =
        err instanceof Error && err.message.trim() !== ""
          ? err.message.trim()
          : "sin detalle";
      throw new Error(
        `No se ha podido traducir a ${params.targetName} (${params.targetLocale}). ` +
          `Cloud Translation: ${cloudError} ` +
          `Modelo de IA (respaldo): ${modelError}`,
      );
    }
    throw err;
  }
}

/**
 * Camino de respaldo: traducción con el modelo de IA.
 *
 * Se le exige JSON estricto y la respuesta se valida aquí: una respuesta
 * truncada o mal formada falla de forma visible en lugar de guardar media
 * traducción.
 */
async function translateWithModel(params: {
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

  const raw = await complete(resolveProvider(), {
    system: instruction,
    user: JSON.stringify(payload),
    temperature: 0,
    maxTokens: 600,
  });

  // Se tolera que el modelo envuelva el JSON en un bloque de código.
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

/** Idioma en el que debe responder el asistente. */
export type AnswerLanguage = { code: string; name: string };

/**
 * Idioma de respuesta a partir del código activo en la interfaz. En español (el
 * idioma en el que están escritas las fichas) se devuelve `undefined`, que es el
 * comportamiento por defecto.
 */
export function answerLanguageFor(
  locale: string | undefined,
): AnswerLanguage | undefined {
  const meta = LOCALES.find((l) => l.code === locale);
  if (!meta || meta.code === "es-ES") return undefined;
  return { code: meta.code, name: meta.short };
}

function assistantInstruction(language?: AnswerLanguage): string {
  const target = language
    ? `${language.name} (${language.code})`
    : "español (es-ES)";
  return (
    `Eres el asistente documental de Doc Manager. Respondes SIEMPRE en ${target}, ` +
    "de forma breve y práctica, para personal que consulta fichas en el trabajo.\n" +
    "Reglas:\n" +
    "1. Usa ÚNICAMENTE la información del catálogo que se te entrega.\n" +
    "2. Si el catálogo no contiene la respuesta, dilo claramente y sugiere revisar el " +
    "catálogo o contactar con el administrador. No inventes datos.\n" +
    "3. Cuando menciones una ficha, escribe su título exacto entre comillas.\n" +
    "4. No inventes precios, fechas, dosis ni medidas que no aparezcan en el catálogo.\n" +
    "5. Cierra la respuesta indicando qué fichas ha usado, por su número ([1], [2]…)."
  );
}

/** El modelo responde usando solo el catálogo que se le entrega. */
export async function answerFromContext(params: {
  question: string;
  catalog: string;
  /** Idioma de la persona que pregunta; sin él, español. */
  language?: AnswerLanguage;
}): Promise<string> {
  return await complete(resolveProvider(), {
    system: assistantInstruction(params.language),
    user: `CATÁLOGO DE FICHAS\n${params.catalog}\n\nPREGUNTA DEL USUARIO\n${params.question}`,
    temperature: 0.2,
    maxTokens: 800,
  });
}
