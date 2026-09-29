"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { answerFromContext } from "./gemini";
import {
  buildCatalogContext,
  rankByKeyword,
  toSources,
  FICHA_KINDS,
  type FichaKind,
  type FichaLike,
} from "./assistant";

const kindValidator = v.union(
  ...FICHA_KINDS.map((k) => v.literal(k)),
);

/**
 * Explicit shape of the internal query result. Written out (instead of inferred)
 * because the action's return validator and the query's return validator would
 * otherwise form a circular type reference.
 */
type CatalogResult = {
  isAdmin: boolean;
  centers: { _id: Id<"workCenters">; name: string; code: string }[];
  fichas: {
    _id: Id<"fichas">;
    title: string;
    kind: FichaKind;
    productName?: string;
    manufacturer?: string;
    url: string;
    workCenterIds: Id<"workCenters">[];
    active: boolean;
  }[];
};

/** Fichas listed as sources under the answer. */
const MAX_SOURCES = 8;
/** Hard cap on the catalog text sent to the model, to bound the request size. */
const MAX_CONTEXT_FICHAS = 40;

/**
 * Answers a question about the ficha catalog.
 *
 * The model only ever receives fichas the caller is allowed to see, so nothing
 * leaks across work centers. Keyword ranking puts the most likely fichas first
 * and the rest follow, letting the model also match by meaning.
 */
export const askFichaQuestion = action({
  args: { question: v.string() },
  returns: v.object({
    answer: v.string(),
    sources: v.array(
      v.object({
        _id: v.id("fichas"),
        title: v.string(),
        kind: kindValidator,
        url: v.string(),
        centerNames: v.array(v.string()),
      }),
    ),
    catalogSize: v.number(),
  }),
  handler: async (ctx, args) => {
    const question = args.question.trim();
    if (question.length === 0) {
      throw new Error("Escribe una pregunta antes de enviar.");
    }

    const catalog: CatalogResult = await ctx.runQuery(
      internal.fichaIndex.visibleCatalog,
      {},
    );
    const visible: FichaLike[] = catalog.fichas.map((f) => ({
      _id: f._id,
      title: f.title,
      kind: f.kind,
      productName: f.productName,
      manufacturer: f.manufacturer,
      url: f.url,
      workCenterIds: f.workCenterIds as string[],
      active: f.active,
    }));

    if (visible.length === 0) {
      return {
        answer:
          "Ahora mismo no hay ninguna ficha en el catálogo al que tienes acceso. Si debería haber alguna, habla con tu administrador.",
        sources: [],
        catalogSize: 0,
      };
    }

    // Most relevant fichas first, then the rest of the catalog so the model can
    // still answer by meaning when the wording does not match.
    const ranked = rankByKeyword(question, visible, MAX_CONTEXT_FICHAS);
    const chosen = new Set(ranked.map((f) => f._id));
    const rest = visible
      .filter((f) => !chosen.has(f._id))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, Math.max(0, MAX_CONTEXT_FICHAS - ranked.length));
    const used = [...ranked, ...rest];

    const answer = await answerFromContext({
      question,
      catalog: buildCatalogContext(used, catalog.centers),
    });

    return {
      answer,
      // The pure helpers work with plain strings; the ids come straight from
      // the database, so the cast is safe at this boundary.
      sources: toSources(used.slice(0, MAX_SOURCES), catalog.centers).map(
        (s) => ({ ...s, _id: s._id as Id<"fichas"> }),
      ),
      catalogSize: visible.length,
    };
  },
});
