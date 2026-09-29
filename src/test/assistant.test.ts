import { describe, expect, test } from "vitest";
import {
  buildCatalogContext,
  keywordScore,
  normalize,
  rankByKeyword,
  toSources,
  type FichaLike,
} from "@/convex/assistant";

const CENTERS = [
  { _id: "c1", name: "MDLZ Montornes", code: "MDLZ_MON" },
  { _id: "c2", name: "Granollers", code: "MDLZ_GRA" },
];

function ficha(over: Partial<FichaLike> = {}): FichaLike {
  return {
    _id: "f1",
    title: "Detergente desinfectante",
    kind: "ficha_tecnica",
    productName: "Hypofoam",
    manufacturer: "Diversey",
    url: "https://example.com/a.pdf",
    workCenterIds: ["c1", "c2"],
    active: true,
    ...over,
  };
}

const FICHAS: FichaLike[] = [
  ficha(),
  ficha({
    _id: "f2",
    title: "Manual de máquina",
    kind: "manual_instrucciones",
    productName: undefined,
    manufacturer: undefined,
    workCenterIds: ["c2"],
  }),
  ficha({
    _id: "f3",
    title: "Guantes de protección",
    kind: "ficha_seguridad",
    productName: "Guante Nitrilo",
    manufacturer: "3M",
    workCenterIds: ["c1"],
  }),
];

describe("normalize", () => {
  test("quita acentos y pasa a minúsculas", () => {
    expect(normalize("Hipócloro")).toBe("hipocloro");
    expect(normalize("MÁQUINA")).toBe("maquina");
  });
});

describe("keywordScore", () => {
  test("encuentra por producto con acentos distintos", () => {
    expect(keywordScore("hipocloro", ficha({ productName: "Hipócloro" }))).toBeGreaterThan(0);
  });

  test("encuentra por fabricante", () => {
    expect(keywordScore("diversey", ficha())).toBeGreaterThan(0);
  });

  test("devuelve 0 cuando no hay relación", () => {
    expect(keywordScore("ascensor de-REYES", ficha())).toBe(0);
  });

  test("el título pesa más que el resto de campos", () => {
    const inTitle = keywordScore("desinfectante", ficha());
    const inProduct = keywordScore("desinfectante", ficha({ title: "Otro nombre" }));
    expect(inTitle).toBeGreaterThan(inProduct);
  });

  test("ignora palabras vacías", () => {
    expect(keywordScore("de la", ficha())).toBe(0);
  });
});

describe("rankByKeyword", () => {
  test("ordena por relevancia y descarta lo que no coincide", () => {
    const ranked = rankByKeyword("guantes 3m", FICHAS, 5);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]._id).toBe("f3");
  });

  test("respeta el límite", () => {
    const ranked = rankByKeyword("ficha", FICHAS, 2);
    expect(ranked).toHaveLength(2);
  });
});

describe("buildCatalogContext", () => {
  test("incluye tipo, producto, fabricante, centros y documento", () => {
    const ctx = buildCatalogContext([ficha()], CENTERS);
    expect(ctx).toContain("[1] Detergente desinfectante");
    expect(ctx).toContain("Tipo: Ficha técnica");
    expect(ctx).toContain("Producto: Hypofoam");
    expect(ctx).toContain("Fabricante: Diversey");
    expect(ctx).toContain("Centros: MDLZ Montornes, Granollers");
    expect(ctx).toContain("https://example.com/a.pdf");
  });

  test("omite los campos opcionales que están vacíos", () => {
    const ctx = buildCatalogContext(
      [ficha({ productName: undefined, manufacturer: undefined })],
      CENTERS,
    );
    expect(ctx).not.toContain("Producto:");
    expect(ctx).not.toContain("Fabricante:");
  });

  test("avisa cuando el catálogo está vacío", () => {
    expect(buildCatalogContext([], CENTERS)).toContain("vacío");
  });
});

describe("toSources", () => {
  test("devuelve las fichas con sus centros resueltos", () => {
    const sources = toSources([FICHAS[1]], CENTERS);
    expect(sources).toEqual([
      {
        _id: "f2",
        title: "Manual de máquina",
        kind: "manual_instrucciones",
        url: "https://example.com/a.pdf",
        centerNames: ["Granollers"],
      },
    ]);
  });

  test("no inventa centros si el id no existe", () => {
    const sources = toSources([ficha({ workCenterIds: ["nope"] })], CENTERS);
    expect(sources[0].centerNames).toEqual([]);
  });
});
