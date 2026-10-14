import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const modules = {
  "_generated/server": () => import("@/convex/_generated/server"),
  schema: () => import("@/convex/schema"),
  access: () => import("@/convex/access"),
  fichas: () => import("@/convex/fichas"),
  fichaTypes: () => import("@/convex/fichaTypes"),
};

type T = ReturnType<typeof setup>;

function setup() {
  return convexTest(schema, modules);
}

async function seed(t: T) {
  const adminId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "admin@example.com",
      role: "admin",
      workCenterIds: [],
    }),
  );
  const admin = t.withIdentity({ subject: adminId });

  const centerA = await admin.mutation(api.access.createCenter, {
    name: "MDLZ Montornes",
    code: "MDLZ_MON",
    address: "Calle Raiguer 1",
  });
  const centerB = await admin.mutation(api.access.createCenter, {
    name: "Granollers",
    code: "MDLZ_GRA",
    address: "Calle Galileo Galilei 2",
  });

  return { admin, adminId, centerA, centerB };
}

async function signInMember(t: T, centerId: Id<"workCenters">) {
  const memberId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "member@example.com",
      role: "user",
      workCenterIds: [centerId],
    }),
  );
  return t.withIdentity({ subject: memberId });
}

describe("tipos de ficha: catálogo inicial", () => {
  test("un catálogo nuevo ofrece los cuatro tipos de serie", async () => {
    const { admin } = await seed(setup());
    const types = await admin.query(api.fichaTypes.listTypes, {});

    expect(types.map((t) => t.slug)).toEqual([
      "ficha_tecnica",
      "ficha_seguridad",
      "manual_instrucciones",
      "instrucciones_trabajo",
    ]);
    expect(types.every((t) => t.builtIn)).toBe(true);
    expect(types[0].name).toBe("Ficha técnica");
  });

  test("un tipo sin fila propia usa los valores de fábrica", async () => {
    const t = setup();
    const { admin } = await seed(t);
    const stored = await t.run(async (ctx) =>
      ctx.db.query("fichaTypes").collect(),
    );
    expect(stored).toHaveLength(0);

    const types = await admin.query(api.fichaTypes.listTypes, {});
    expect(types).toHaveLength(4);
  });
});

describe("tipos de ficha: crear", () => {
  test("crea un tipo propio y lo deja disponible en el catálogo", async () => {
    const { admin } = await seed(setup());

    const result = await admin.mutation(api.fichaTypes.createType, {
      name: "Permiso de trabajo",
      icon: "clipboard-list",
    });
    expect(result).toEqual({ slug: "permiso_de_trabajo", created: true });

    const types = await admin.query(api.fichaTypes.listTypes, {});
    const created = types.find((t) => t.slug === "permiso_de_trabajo");
    expect(created?.name).toBe("Permiso de trabajo");
    expect(created?.icon).toBe("clipboard-list");
    expect(created?.builtIn).toBe(false);
    // Queda detrás de los cuatro tipos de serie.
    expect(types[4].slug).toBe("permiso_de_trabajo");
  });

  test("se niega a duplicar un nombre", async () => {
    const { admin } = await seed(setup());
    await admin.mutation(api.fichaTypes.createType, {
      name: "Permiso de trabajo",
      icon: "clipboard-list",
    });

    await expect(
      admin.mutation(api.fichaTypes.createType, {
        name: " permiso DE TRABAJO ",
        icon: "file-text",
      }),
    ).rejects.toThrow(/Ya existe/);
  });

  test("se niega a duplicar el identificador de un tipo distinto", async () => {
    const { admin } = await seed(setup());
    await admin.mutation(api.fichaTypes.createType, {
      name: "Certificado",
      icon: "file-text",
    });

    await expect(
      admin.mutation(api.fichaTypes.createType, {
        name: "Certificado!",
        icon: "file-text",
      }),
    ).rejects.toThrow(/Ya existe/);
  });

  test("rechaza nombres sin letras y nombres demasiado cortos", async () => {
    const { admin } = await seed(setup());

    await expect(
      admin.mutation(api.fichaTypes.createType, {
        name: "¿?",
        icon: "file-text",
      }),
    ).rejects.toThrow(/identificador/);

    await expect(
      admin.mutation(api.fichaTypes.createType, {
        name: "A",
        icon: "file-text",
      }),
    ).rejects.toThrow(/2 caracteres/);
  });

  test("reutiliza un tipo retirado en lugar de duplicarlo", async () => {
    const { admin } = await seed(setup());
    await admin.mutation(api.fichaTypes.deleteType, {
      slug: "instrucciones_trabajo",
    });

    const result = await admin.mutation(api.fichaTypes.createType, {
      name: "Instrucción de trabajo",
      icon: "list-checks",
    });
    expect(result).toEqual({ slug: "instrucciones_trabajo", created: false });

    const types = await admin.query(api.fichaTypes.listTypes, {});
    expect(types.map((t) => t.slug)).toContain("instrucciones_trabajo");
  });
});

describe("tipos de ficha: modificar", () => {
  test("renombra un tipo de serie conservando su identificador", async () => {
    const { admin, centerA } = await seed(setup());

    const fichaId = await admin.mutation(api.fichas.create, {
      title: "Detergente",
      kind: "ficha_tecnica",
      url: "https://example.com/a.pdf",
      workCenterIds: [centerA],
    });
    await admin.mutation(api.fichaTypes.updateType, {
      slug: "ficha_tecnica",
      name: "Ficha técnica de máquina",
      icon: "wrench",
    });

    const types = await admin.query(api.fichaTypes.listTypes, {});
    const renamed = types.find((t) => t.slug === "ficha_tecnica");
    expect(renamed?.name).toBe("Ficha técnica de máquina");
    expect(renamed?.icon).toBe("wrench");

    // La ficha no se ha movido de tipo.
    const fichas = await admin.query(api.fichas.listAll, {});
    expect(fichas.find((f) => f._id === fichaId)?.kind).toBe("ficha_tecnica");
  });

  test("se niega a renombrar un tipo con el nombre de otro", async () => {
    const { admin } = await seed(setup());
    await expect(
      admin.mutation(api.fichaTypes.updateType, {
        slug: "ficha_tecnica",
        name: "Ficha de seguridad",
        icon: "file-text",
      }),
    ).rejects.toThrow(/Ya existe/);
  });

  test("un tipo retirado se edita sin volver a aparecer", async () => {
    const { admin } = await seed(setup());
    await admin.mutation(api.fichaTypes.deleteType, {
      slug: "manual_instrucciones",
    });

    await admin.mutation(api.fichaTypes.updateType, {
      slug: "manual_instrucciones",
      name: "Manual de equipo",
      icon: "book-open",
    });

    const types = await admin.query(api.fichaTypes.listTypes, {});
    expect(types.map((t) => t.slug)).not.toContain("manual_instrucciones");

    const all = await admin.query(api.fichaTypes.listTypesAdmin, {});
    const retired = all.find((t) => t.slug === "manual_instrucciones");
    expect(retired?.name).toBe("Manual de equipo");
    expect(retired?.hidden).toBe(true);
  });

  test("no se puede editar un tipo inexistente", async () => {
    const { admin } = await seed(setup());
    await expect(
      admin.mutation(api.fichaTypes.updateType, {
        slug: "inventado",
        name: "Inventado",
        icon: "file-text",
      }),
    ).rejects.toThrow(/no existe/);
  });
});

describe("tipos de ficha: borrar y recuperar", () => {
  test("retira un tipo de serie vacío y permite recuperarlo", async () => {
    const { admin } = await seed(setup());

    await admin.mutation(api.fichaTypes.deleteType, {
      slug: "instrucciones_trabajo",
    });
    let types = await admin.query(api.fichaTypes.listTypes, {});
    expect(types.map((t) => t.slug)).not.toContain("instrucciones_trabajo");

    const all = await admin.query(api.fichaTypes.listTypesAdmin, {});
    expect(all.find((t) => t.slug === "instrucciones_trabajo")?.hidden).toBe(
      true,
    );

    await admin.mutation(api.fichaTypes.restoreType, {
      slug: "instrucciones_trabajo",
    });
    types = await admin.query(api.fichaTypes.listTypes, {});
    expect(types.map((t) => t.slug)).toContain("instrucciones_trabajo");
  });

  test("no borra un tipo que está en uso", async () => {
    const { admin, centerA } = await seed(setup());
    await admin.mutation(api.fichas.create, {
      title: "Guantes",
      kind: "ficha_seguridad",
      url: "https://example.com/g.pdf",
      workCenterIds: [centerA],
    });

    await expect(
      admin.mutation(api.fichaTypes.deleteType, { slug: "ficha_seguridad" }),
    ).rejects.toThrow(/No se puede borrar/);

    const types = await admin.query(api.fichaTypes.listTypes, {});
    expect(types.map((t) => t.slug)).toContain("ficha_seguridad");
  });

  test("borra un tipo propio sin fichas", async () => {
    const { admin } = await seed(setup());
    await admin.mutation(api.fichaTypes.createType, {
      name: "Permiso de trabajo",
      icon: "clipboard-list",
    });

    await admin.mutation(api.fichaTypes.deleteType, {
      slug: "permiso_de_trabajo",
    });
    const types = await admin.query(api.fichaTypes.listTypes, {});
    expect(types.map((t) => t.slug)).not.toContain("permiso_de_trabajo");
  });

  test("el panel de gestión cuenta las fichas de cada tipo", async () => {
    const { admin, centerA } = await seed(setup());
    await admin.mutation(api.fichas.create, {
      title: "Detergente",
      kind: "ficha_tecnica",
      url: "https://example.com/a.pdf",
      workCenterIds: [centerA],
    });

    const all = await admin.query(api.fichaTypes.listTypesAdmin, {});
    expect(all.find((t) => t.slug === "ficha_tecnica")?.fichaCount).toBe(1);
    expect(all.find((t) => t.slug === "ficha_seguridad")?.fichaCount).toBe(0);
  });

  test("se niega a recuperar un tipo que no está retirado", async () => {
    const { admin } = await seed(setup());
    await expect(
      admin.mutation(api.fichaTypes.restoreType, { slug: "ficha_tecnica" }),
    ).rejects.toThrow(/no está retirado/);
  });
});

describe("fichas: validación del tipo", () => {
  test("rechaza una ficha con un tipo que no existe", async () => {
    const { admin, centerA } = await seed(setup());
    await expect(
      admin.mutation(api.fichas.create, {
        title: "Con tipo inventado",
        kind: "inventado",
        url: "https://example.com/x.pdf",
        workCenterIds: [centerA],
      }),
    ).rejects.toThrow(/no existe/);
  });

  test("rechaza una ficha con un tipo retirado", async () => {
    const { admin, centerA } = await seed(setup());
    await admin.mutation(api.fichaTypes.deleteType, {
      slug: "instrucciones_trabajo",
    });

    await expect(
      admin.mutation(api.fichas.create, {
        title: "Instrucción antigua",
        kind: "instrucciones_trabajo",
        url: "https://example.com/x.pdf",
        workCenterIds: [centerA],
      }),
    ).rejects.toThrow(/no existe/);
  });

  test("acepta una ficha del tipo creado por el administrador", async () => {
    const { admin, centerA, centerB } = await seed(setup());
    await admin.mutation(api.fichaTypes.createType, {
      name: "Permiso de trabajo",
      icon: "clipboard-list",
    });

    const fichaId = await admin.mutation(api.fichas.create, {
      title: "Trabajo en caliente",
      kind: "permiso_de_trabajo",
      url: "https://example.com/caliente.pdf",
      workCenterIds: [centerA, centerB],
    });

    const fichas = await admin.query(api.fichas.listAll, {});
    const created = fichas.find((f) => f._id === fichaId);
    expect(created?.kind).toBe("permiso_de_trabajo");
    expect(created?.workCenterIds).toEqual([centerA, centerB]);
  });

  test("rechaza mover una ficha a un tipo retirado", async () => {
    const { admin, centerA } = await seed(setup());
    const fichaId = await admin.mutation(api.fichas.create, {
      title: "Detergente",
      kind: "ficha_tecnica",
      url: "https://example.com/a.pdf",
      workCenterIds: [centerA],
    });
    await admin.mutation(api.fichaTypes.deleteType, {
      slug: "manual_instrucciones",
    });

    await expect(
      admin.mutation(api.fichas.update, {
        fichaId,
        kind: "manual_instrucciones",
      }),
    ).rejects.toThrow(/no existe/);
  });
});

describe("tipos de ficha: visibilidad por centro", () => {
  test("una ficha de un tipo nuevo llega solo a los centros asignados", async () => {
    const t = setup();
    const { admin, centerA, centerB } = await seed(t);
    await admin.mutation(api.fichaTypes.createType, {
      name: "Permiso de trabajo",
      icon: "clipboard-list",
    });
    await admin.mutation(api.fichas.create, {
      title: "Trabajo en caliente",
      kind: "permiso_de_trabajo",
      url: "https://example.com/caliente.pdf",
      workCenterIds: [centerB],
    });

    const inB = await signInMember(t, centerB);
    const inA = await signInMember(t, centerA);

    expect(
      (await inB.query(api.fichas.listMine, {})).map((f) => f.title),
    ).toEqual(["Trabajo en caliente"]);
    expect(await inA.query(api.fichas.listMine, {})).toHaveLength(0);
  });

  test("un usuario normal ve los tipos activos pero no los retirados", async () => {
    const t = setup();
    const { admin, centerA } = await seed(t);
    await admin.mutation(api.fichaTypes.deleteType, {
      slug: "manual_instrucciones",
    });
    const member = await signInMember(t, centerA);

    const types = await member.query(api.fichaTypes.listTypes, {});
    expect(types.map((t) => t.slug)).not.toContain("manual_instrucciones");
    expect(types).toHaveLength(3);
  });
});

describe("tipos de ficha: permisos", () => {
  test("un usuario normal no puede gestionar tipos", async () => {
    const t = setup();
    const { centerA } = await seed(t);
    const member = await signInMember(t, centerA);

    await expect(
      member.mutation(api.fichaTypes.createType, {
        name: "Permiso de trabajo",
        icon: "clipboard-list",
      }),
    ).rejects.toThrow(/administradores/);

    await expect(
      member.mutation(api.fichaTypes.deleteType, { slug: "ficha_tecnica" }),
    ).rejects.toThrow(/administradores/);

    await expect(
      member.query(api.fichaTypes.listTypesAdmin, {}),
    ).rejects.toThrow(/administradores/);
  });

  test("sin sesión no se pueden leer los tipos", async () => {
    const t = setup();
    await seed(t);
    await expect(t.query(api.fichaTypes.listTypes, {})).rejects.toThrow(
      /iniciar sesión/,
    );
  });
});
