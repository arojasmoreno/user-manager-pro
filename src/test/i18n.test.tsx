import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";
import { LOCALES, getLocale, isLocale } from "@/i18n/locales";
import { en } from "@/i18n/dictionaries/en";
import { fr } from "@/i18n/dictionaries/fr";
import { ar } from "@/i18n/dictionaries/ar";
import { mnk } from "@/i18n/dictionaries/mnk";

const modules = {
  "_generated/server": () => import("@/convex/_generated/server"),
  schema: () => import("@/convex/schema"),
  access: () => import("@/convex/access"),
  fichas: () => import("@/convex/fichas"),
  fichaIndex: () => import("@/convex/fichaIndex"),
  traducciones: () => import("@/convex/traducciones"),
};

type T = ReturnType<typeof setup>;

function setup() {
  return convexTest(schema, modules);
}

const DICTIONARIES: Record<string, Record<string, string>> = {
  en,
  fr,
  ar,
  mnk,
};

describe("i18n: registro de idiomas", () => {
  test("son los cinco idiomas pedidos", () => {
    expect(LOCALES.map((l) => l.code)).toEqual([
      "es-ES",
      "fr-FR",
      "en-GB",
      "ar-MA",
      "mnk",
    ]);
  });

  test("solo el árabe va de derecha a izquierda", () => {
    expect(getLocale("ar-MA").dir).toBe("rtl");
    for (const l of LOCALES) {
      if (l.code !== "ar-MA") expect(l.dir).toBe("ltr");
    }
  });

  test("cada idioma tiene su bandera de país", () => {
    expect(LOCALES.map((l) => l.country)).toEqual(["ES", "FR", "GB", "MA", "GM"]);
  });

  test("reconoce un código válido y rechaza cualquier otro", () => {
    expect(isLocale("fr-FR")).toBe(true);
    expect(isLocale("mnk")).toBe(true);
    expect(isLocale("de-DE")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe("i18n: diccionarios", () => {
  test("ningún idioma traduce a una cadena vacía", () => {
    for (const [name, dict] of Object.entries(DICTIONARIES)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), `${name}: "${key}"`).not.toBe("");
      }
    }
  });

  test("mantienen los marcadores de posición de las fichas", () => {
    for (const dict of Object.values(DICTIONARIES)) {
      if (dict["{n} fichas"]) expect(dict["{n} fichas"]).toContain("{n}");
      if (dict["{n} usuarios"]) expect(dict["{n} usuarios"]).toContain("{n}");
    }
  });

  test("el árabe no se ha colado con caracteres chinos", () => {
    for (const value of Object.values(ar)) {
      expect(value).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });
});

async function seed(t: T) {
  const adminId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "admin@example.com", role: "admin" }),
  );
  const admin = t.withIdentity({ subject: adminId });

  const centerA = await admin.mutation(api.access.createCenter, {
    name: "MDLZ Montornes",
    code: "MDLZ_MON",
    address: "Calle Raiguer 1",
  });
  const centerB = await admin.mutation(api.access.createCenter, {
    name: "MDLZ Granollers",
    code: "MDLZ_GRA",
    address: "Calle Galileo 2",
  });
  const fichaA = await admin.mutation(api.fichas.create, {
    title: "Detergente desinfectante",
    kind: "ficha_tecnica",
    productName: "Hypofoam",
    manufacturer: "Diversey",
    url: "https://example.com/a.pdf",
    workCenterIds: [centerA],
  });
  const fichaB = await admin.mutation(api.fichas.create, {
    title: "Manual de máquina",
    kind: "manual_instrucciones",
    url: "https://example.com/b.pdf",
    workCenterIds: [centerB],
  });

  const memberId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "usuario@example.com",
      role: "user",
      workCenterIds: [centerB],
    }),
  );

  return { admin, member: t.withIdentity({ subject: memberId }), fichaA, fichaB };
}

describe("traducciones de fichas", () => {
  test("el administrador guarda una traducción a mano", async () => {
    const { admin, fichaA } = await seed(setup());
    await admin.mutation(api.traducciones.saveTranslation, {
      fichaId: fichaA,
      locale: "fr-FR",
      title: "Détergent désinfectant",
      productName: "Hypofoam",
    });

    const rows = await admin.query(api.traducciones.listTranslations, {
      locale: "fr-FR",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Détergent désinfectant");
    expect(rows[0].source).toBe("manual");
  });

  test("un usuario no puede escribir traducciones", async () => {
    const { member, fichaA } = await seed(setup());
    await expect(
      member.mutation(api.traducciones.saveTranslation, {
        fichaId: fichaA,
        locale: "fr-FR",
        title: "Pirate",
      }),
    ).rejects.toThrow(/administradores/i);
  });

  test("un usuario no ve las traducciones de fichas de otros centros", async () => {
    const { admin, member, fichaA, fichaB } = await seed(setup());
    await admin.mutation(api.traducciones.saveTranslation, {
      fichaId: fichaA,
      locale: "en-GB",
      title: "Disinfectant detergent",
    });
    await admin.mutation(api.traducciones.saveTranslation, {
      fichaId: fichaB,
      locale: "en-GB",
      title: "Machine manual",
    });

    const rows = await member.query(api.traducciones.listTranslations, {
      locale: "en-GB",
    });
    expect(rows.map((r) => r.fichaId)).toEqual([fichaB]);
    expect(rows.map((r) => r.title)).not.toContain("Disinfectant detergent");
  });

  test("el idioma de origen no necesita traducción", async () => {
    const { admin, fichaA } = await seed(setup());
    await admin.mutation(api.traducciones.saveTranslation, {
      fichaId: fichaA,
      locale: "es-ES",
      title: "Duplicado",
    });
    expect(
      await admin.query(api.traducciones.listTranslations, { locale: "es-ES" }),
    ).toEqual([]);
    expect(
      await admin.query(api.traducciones.missingLocales, { fichaId: fichaA }),
    ).toEqual(["fr-FR", "en-GB", "ar-MA", "mnk"]);
  });

  test("traducir de nuevo sobrescribe la versión anterior", async () => {
    const { admin, fichaA } = await seed(setup());
    await admin.mutation(api.traducciones.saveTranslation, {
      fichaId: fichaA,
      locale: "mnk",
      title: "Versión uno",
    });
    await admin.mutation(api.traducciones.saveTranslation, {
      fichaId: fichaA,
      locale: "mnk",
      title: "Versión dos",
    });

    const rows = await admin.query(api.traducciones.listTranslations, {
      locale: "mnk",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Versión dos");
  });

  test("rechaza un idioma desconocido", async () => {
    const { admin } = await seed(setup());
    expect(
      await admin.query(api.traducciones.listTranslations, { locale: "de-DE" }),
    ).toEqual([]);
  });
});
