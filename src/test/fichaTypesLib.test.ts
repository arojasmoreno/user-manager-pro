import { describe, expect, test } from "vitest";
import {
  DEFAULT_FICHA_TYPES,
  fichaTypeLabel,
  mergeFichaTypes,
  nextFichaTypeOrder,
  sameFichaTypeName,
  slugifyFichaType,
  type FichaTypeRow,
} from "@/lib/fichaTypes";

describe("slugifyFichaType", () => {
  test("quita acentos y convierte espacios en guiones bajos", () => {
    expect(slugifyFichaType("Permiso de trabajo")).toBe("permiso_de_trabajo");
    expect(slugifyFichaType("Instrucción técnica")).toBe(
      "instruccion_tecnica",
    );
  });

  test("limpia signos y no deja guiones sueltos al final", () => {
    expect(slugifyFichaType("  Ficha (FR)  ")).toBe("ficha_fr");
  });

  test("devuelve vacío cuando el nombre no tiene letras ni números", () => {
    expect(slugifyFichaType("¿?¡!")).toBe("");
  });
});

describe("sameFichaTypeName", () => {
  test("ignora acentos, mayúsculas y espacios sobrantes", () => {
    expect(sameFichaTypeName("Ficha TÉCNICA ", " ficha tecnica")).toBe(true);
    expect(sameFichaTypeName("Ficha técnica", "Ficha de seguridad")).toBe(false);
  });
});

describe("mergeFichaTypes", () => {
  test("sin filas devuelve los cuatro tipos de serie", () => {
    const types = mergeFichaTypes([]);
    expect(types.map((t) => t.slug)).toEqual(
      DEFAULT_FICHA_TYPES.map((t) => t.slug),
    );
    expect(types.every((t) => t.builtIn)).toBe(true);
    expect(types[0].name).toBe("Ficha técnica");
  });

  test("una fila con slug de serie lo sobrescribe sin duplicarlo", () => {
    const rows: FichaTypeRow[] = [
      {
        slug: "ficha_tecnica",
        name: "Ficha técnica de máquina",
        icon: "wrench",
        order: 10,
      },
    ];
    const types = mergeFichaTypes(rows);
    expect(types).toHaveLength(4);
    const renamed = types.find((t) => t.slug === "ficha_tecnica");
    expect(renamed?.name).toBe("Ficha técnica de máquina");
    expect(renamed?.icon).toBe("wrench");
    expect(renamed?.builtIn).toBe(true);
  });

  test("añade los tipos propios ordenados detrás de los de serie", () => {
    const rows: FichaTypeRow[] = [
      {
        slug: "permiso_trabajo",
        name: "Permiso de trabajo",
        icon: "clipboard-list",
        order: 50,
      },
    ];
    const types = mergeFichaTypes(rows);
    expect(types).toHaveLength(5);
    expect(types[4].slug).toBe("permiso_trabajo");
    expect(types[4].builtIn).toBe(false);
  });

  test("oculta los tipos retirados solo si no se piden expresamente", () => {
    const rows: FichaTypeRow[] = [
      {
        slug: "instrucciones_trabajo",
        name: "Instrucción de trabajo",
        icon: "list-checks",
        order: 40,
        hidden: true,
      },
    ];
    const visible = mergeFichaTypes(rows);
    expect(visible.map((t) => t.slug)).not.toContain("instrucciones_trabajo");

    const all = mergeFichaTypes(rows, { includeHidden: true });
    const retired = all.find((t) => t.slug === "instrucciones_trabajo");
    expect(retired?.hidden).toBe(true);
  });

  test("sustituye un icono desconocido por el de documento", () => {
    const rows: FichaTypeRow[] = [
      { slug: "raro", name: "Raro", icon: "no-existe", order: 5 },
    ];
    expect(mergeFichaTypes(rows)[0].icon).toBe("file-text");
  });
});

describe("fichaTypeLabel", () => {
  test("usa el nombre del tipo cuando existe", () => {
    const types = mergeFichaTypes([
      {
        slug: "permiso_trabajo",
        name: "Permiso de trabajo",
        icon: "clipboard-list",
        order: 50,
      },
    ]);
    expect(fichaTypeLabel("permiso_trabajo", types)).toBe("Permiso de trabajo");
  });

  test("mantiene la etiqueta de serie si la lista aún no ha cargado", () => {
    expect(fichaTypeLabel("ficha_seguridad", [])).toBe("Ficha de seguridad");
  });

  test("cae al identificador cuando no reconoce el tipo", () => {
    expect(fichaTypeLabel("antiguo", mergeFichaTypes([]))).toBe("antiguo");
  });
});

describe("nextFichaTypeOrder", () => {
  test("deja el tipo nuevo al final, incluso tras retirar uno", () => {
    const rows: FichaTypeRow[] = [
      {
        slug: "instrucciones_trabajo",
        name: "Instrucción de trabajo",
        icon: "list-checks",
        order: 40,
        hidden: true,
      },
    ];
    expect(nextFichaTypeOrder(rows)).toBe(50);
  });
});
