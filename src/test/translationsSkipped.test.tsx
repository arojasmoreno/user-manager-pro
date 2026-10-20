import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * El interruptor de traducciones está apagado en producción (`features.ts`),
 * pero el código sigue implementado. Este test usa el módulo real —sin mock—
 * para asegurar que, con el interruptor apagado:
 *
 *  - las fichas se muestran en su idioma original aunque la interfaz esté en
 *    otro idioma,
 *  - NO se pide la consulta de traducciones al servidor (se salta), y
 *  - NO aparece el aviso interno «Sin traducir».
 *
 * El camino con el interruptor encendido se prueba en `tabs.test.tsx`.
 */

type QueryResult =
  | { status: "pending" }
  | { status: "success"; data: unknown }
  | { status: "error"; error: Error };

const h = vi.hoisted(() => ({
  index: 0,
  queue: [] as QueryResult[],
  /** Args de cada llamada, para comprobar qué consultas se saltan. */
  calls: [] as { query: unknown; args: unknown }[],
}));

vi.mock("convex/react", () => ({
  useQuery_experimental: ({
    query,
    args,
  }: {
    query: unknown;
    args: unknown;
  }) => {
    h.calls.push({ query, args });
    const i = h.index++;
    return h.queue[i] ?? { status: "pending" };
  },
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: { role: "admin", email: "admin@example.com" },
  }),
}));

import { FichasSection } from "@/components/FichasSection";
import { I18nProvider } from "@/i18n";

const CENTERS = [
  {
    _id: "c1",
    _creationTime: 1,
    name: "MDLZ Montornes",
    code: "MDLZ_MON",
    address: "Calle Raiguer 1",
  },
];

const FICHAS = [
  {
    _id: "f1",
    _creationTime: 3,
    title: "Detergente desinfectante",
    kind: "ficha_tecnica",
    productName: "Hypofoam",
    manufacturer: "Diversey",
    url: "https://example.com/a.pdf",
    workCenterIds: ["c1"],
    active: true,
  },
];

const TYPES = [
  {
    _id: "t1",
    _creationTime: 6,
    slug: "ficha_tecnica",
    name: "Ficha técnica",
    icon: "file-text",
    order: 10,
    builtIn: true,
    hidden: false,
    fichaCount: 1,
  },
];

/** Una traducción ya guardada que el interruptor apagado debe ignorar. */
const TRANSLATIONS = [
  {
    fichaId: "f1",
    locale: "fr-FR",
    title: "Détergent désinfectant",
    productName: "Hypofoam",
    manufacturer: "Diversey",
    source: "manual",
  },
];

const ok = (data: unknown): QueryResult => ({ status: "success", data });

beforeEach(() => {
  h.index = 0;
  h.queue = [];
  h.calls = [];
  window.localStorage.setItem("doc-manager-locale", "fr-FR");
});

describe("traducciones apagadas por interruptor", () => {
  test("muestra el idioma original, ignora las guardadas y no avisa «Sin traducir»", () => {
    // Orden de consultas de FichasSection (admin): listMine, listAll,
    // listCenters, listMyCenters (saltada), listTypes (saltada),
    // listTypesAdmin y, la última, listTranslations — que ahora se salta.
    h.queue = [
      ok(FICHAS),
      ok(FICHAS),
      ok(CENTERS),
      { status: "pending" },
      { status: "pending" },
      ok(TYPES),
      ok(TRANSLATIONS),
    ];

    render(
      <MemoryRouter>
        <I18nProvider>
          <FichasSection />
        </I18nProvider>
      </MemoryRouter>,
    );

    // Se ve el título original, no la traducción guardada.
    expect(screen.getByText("Detergente desinfectante")).toBeTruthy();
    expect(screen.queryByText("Détergent désinfectant")).toBeNull();
    // Sin el aviso interno: con el interruptor apagado nada está «sin traducir».
    expect(screen.queryByText("Sin traducir")).toBeNull();
  });

  test("no llega a pedir la consulta de traducciones al servidor", () => {
    h.queue = [
      ok(FICHAS),
      ok(FICHAS),
      ok(CENTERS),
      { status: "pending" },
      { status: "pending" },
      ok(TYPES),
      ok(TRANSLATIONS),
    ];

    render(
      <MemoryRouter>
        <I18nProvider>
          <FichasSection />
        </I18nProvider>
      </MemoryRouter>,
    );

    // La séptima consulta (listTranslations) se llama con «skip», así que no
    // se abre una suscripción a traducciones en cada carga del catálogo. La
    // octava es la del histórico de versiones del diálogo de edición, también
    // saltada mientras el diálogo siga cerrado.
    expect(h.calls).toHaveLength(8);
    expect(h.calls[6].args).toBe("skip");
    expect(h.calls[7].args).toBe("skip");
  });
});
