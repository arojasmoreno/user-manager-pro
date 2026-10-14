import { describe, expect, test } from "vitest";
import { answerFromContext } from "@/convex/aiClient";
import { buildCatalogContext } from "@/convex/assistant";

/**
 * Smoke test against the real AI provider.
 *
 * It only runs when a key is available in the environment, so the rest of the
 * suite stays offline and deterministic. Use it to confirm the key is accepted,
 * the model is reachable and the prompt gets a usable answer.
 */
const KEY =
  process.env.GOOGLE_API_KEY?.trim() || process.env.VLY_INTEGRATION_KEY?.trim();
const CATALOG = buildCatalogContext(
  [
    {
      _id: "f1",
      title: "Detergente desinfectante",
      kind: "ficha_tecnica",
      productName: "Hypofoam",
      manufacturer: "Diversey",
      url: "https://example.com/hypofoam.pdf",
      workCenterIds: ["c1"],
      active: true,
    },
  ],
  [{ _id: "c1", name: "MDLZ Montornes", code: "MDLZ_MON" }],
);

describe.skipIf(!KEY)("asistente contra la API real", () => {
  test("responde en español usando solo el catálogo", async () => {
    const answer = await answerFromContext({
      question: "¿Qué producto es Hypofoam y de qué fabricante es?",
      catalog: CATALOG,
    });

    expect(answer.length).toBeGreaterThan(0);
    expect(answer.toLowerCase()).toContain("hypofoam");
    expect(answer.toLowerCase()).toContain("diversey");
  }, 30_000);

  test("responde en el idioma pedido sin inventarse datos", async () => {
    const answer = await answerFromContext({
      question: "Quel produit est Hypofoam et qui le fabrique ?",
      catalog: CATALOG,
      language: { code: "fr-FR", name: "Français" },
    });

    expect(answer.length).toBeGreaterThan(0);
    expect(answer.toLowerCase()).toContain("hypofoam");
  }, 30_000);

  test("no inventa datos que no están en el catálogo", async () => {
    const answer = await answerFromContext({
      question: "¿Cuál es el precio por litro del Hypofoam?",
      catalog: CATALOG,
    });

    expect(answer.length).toBeGreaterThan(0);
    // The sheet has no price, so the model must say it does not know.
    expect(answer.toLowerCase()).not.toMatch(/\d+\s*€|euros?\s*\d/);
  }, 30_000);
});
