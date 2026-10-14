/**
 * Pure helpers for the ficha assistant. No Convex or network code lives here so
 * the ranking and context-building rules can be unit tested directly.
 */

import { DEFAULT_KIND_LABELS } from "../lib/fichaTypes";

export type FichaLike = {
  _id: string;
  title: string;
  /** Slug del tipo de ficha; los tipos los define el administrador. */
  kind: string;
  /** Nombre visible del tipo. Si falta, se usa el de serie o el propio slug. */
  kindLabel?: string;
  productName?: string;
  manufacturer?: string;
  url: string;
  workCenterIds: string[];
  active: boolean;
};

export type CenterLike = { _id: string; name: string; code: string };

/**
 * Etiqueta legible del tipo de una ficha. Los tipos de serie mantienen su
 * nombre en español aunque la consulta no los traiga; un tipo creado por el
 * administrador llega ya resuelto en `kindLabel`.
 */
export function fichaKindLabel(ficha: Pick<FichaLike, "kind" | "kindLabel">): string {
  const custom = ficha.kindLabel?.trim();
  if (custom) return custom;
  return DEFAULT_KIND_LABELS[ficha.kind] ?? ficha.kind;
}

/** Lowercases and strips accents so "hipocloro" matches "hipócloro". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const STOP_WORDS = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "y", "o", "que", "para",
  "con", "en", "es", "son", "hay", "por", "se", "su", "sus", "lo", "al", "me",
  "mi", "que", "como", "donde", "cual", "the", "of", "and",
]);

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/** The text a ficha contributes to the catalog, also used for keyword search. */
export function fichaHaystack(f: FichaLike): string {
  return normalize(
    [f.title, f.productName, f.manufacturer, fichaKindLabel(f)].join(" "),
  );
}

/**
 * Scores a question against a ficha. Returns 0 when nothing matches, so callers
 * can drop those fichas from the context.
 */
export function keywordScore(question: string, f: FichaLike): number {
  const haystack = fichaHaystack(f);
  const title = normalize(f.title);
  let score = 0;
  for (const token of tokenize(question)) {
    if (title.includes(token)) score += 3;
    else if (haystack.includes(token)) score += 1;
  }
  return score;
}

/** Ranks fichas by keyword relevance, best first. */
export function rankByKeyword(
  question: string,
  fichas: FichaLike[],
  limit: number,
): FichaLike[] {
  return fichas
    .map((f) => ({ f, score: keywordScore(question, f) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.title.localeCompare(b.f.title))
    .slice(0, limit)
    .map((x) => x.f);
}

function centerNamesFor(f: FichaLike, centers: CenterLike[]): string[] {
  return f.workCenterIds
    .map((id) => centers.find((c) => c._id === id)?.name)
    .filter((n): n is string => Boolean(n));
}

/**
 * Renders the fichas the assistant is allowed to reason about. The model only
 * ever sees this text, so nothing outside the user's permissions can leak.
 */
export function buildCatalogContext(
  fichas: FichaLike[],
  centers: CenterLike[],
): string {
  if (fichas.length === 0) {
    return "(El catálogo accesible para este usuario está vacío.)";
  }
  return fichas
    .map((f, i) => {
      const names = centerNamesFor(f, centers);
      const lines = [
        `[${i + 1}] ${f.title}`,
        `    Tipo: ${fichaKindLabel(f)}`,
      ];
      if (f.productName) lines.push(`    Producto: ${f.productName}`);
      if (f.manufacturer) lines.push(`    Fabricante: ${f.manufacturer}`);
      if (names.length > 0) lines.push(`    Centros: ${names.join(", ")}`);
      lines.push(`    Documento: ${f.url}`);
      return lines.join("\n");
    })
    .join("\n");
}

export type Source = {
  _id: string;
  title: string;
  kind: string;
  /** Nombre visible del tipo, para la etiqueta de la fuente citada. */
  kindLabel: string;
  url: string;
  centerNames: string[];
};

/** Turns the selected fichas into the clickable sources shown under the answer. */
export function toSources(
  fichas: FichaLike[],
  centers: CenterLike[],
): Source[] {
  return fichas.map((f) => ({
    _id: f._id,
    title: f.title,
    kind: f.kind,
    kindLabel: fichaKindLabel(f),
    url: f.url,
    centerNames: centerNamesFor(f, centers),
  }));
}
