import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Pestaña de administración (`AdminWorkspaceShell`).
 *
 * Regresión principal: el shell tenía dos sub-pestañas («Tipos» y «Fichas»)
 * pero ningún conmutador, así que la gestión de fichas del administrador era
 * inalcanzable y la vista de tipos no pintaba la lista. Aquí se comprueba que
 * ambos elementos se ven y que se puede cambiar de sub-pestaña.
 *
 * Los subcomponentes se identifican por su referencia de Convex (cadenas
 * estables), igual que en `fichaComponents.test.tsx`.
 */
vi.mock("@/convex/_generated/api", () => ({
  api: {
    fichaTypes: {
      listTypesAdmin: "fichaTypes:listTypesAdmin",
      listTypes: "fichaTypes:listTypes",
    },
    fichas: {
      listAll: "fichas:listAll",
      create: "fichas:create",
      update: "fichas:update",
      remove: "fichas:remove",
    },
    access: {
      listCenters: "access:listCenters",
    },
    traducciones: {
      listTranslations: "traducciones:listTranslations",
      listByFicha: "traducciones:listByFicha",
      saveTranslation: "traducciones:saveTranslation",
      deleteTranslation: "traducciones:deleteTranslation",
    },
    traduccionesAi: { translateFicha: "traduccionesAi:translateFicha" },
    fichasAdmin: {
      createFichaType: "fichasAdmin:createFichaType",
      updateFichaType: "fichasAdmin:updateFichaType",
      retireFichaType: "fichasAdmin:retireFichaType",
      restoreFichaType: "fichasAdmin:restoreFichaType",
    },
  },
}));

const h = vi.hoisted(() => ({
  results: {} as Record<string, unknown>,
  skips: [] as string[],
}));

vi.mock("convex/react", () => ({
  useQuery_experimental: ({
    query,
    args,
  }: {
    query: string;
    args: unknown;
  }) => {
    if (args === "skip") {
      h.skips.push(query);
      return { status: "pending" };
    }
    const result = h.results[query];
    if (result === undefined) return { status: "pending" };
    if (result instanceof Error) return { status: "error", error: result };
    return { status: "success", data: result };
  },
  useMutation: () => vi.fn().mockResolvedValue(null),
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: { role: "admin", email: "admin@example.com" },
  }),
}));

import { AdminWorkspaceShell } from "@/components/AdminWorkspaceShell";
import { I18nProvider } from "@/i18n";

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
  {
    _id: "t2",
    _creationTime: 7,
    slug: "permiso_trabajo",
    name: "Permiso de trabajo",
    icon: "clipboard-list",
    order: 50,
    builtIn: false,
    hidden: false,
    fichaCount: 1,
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

const CENTERS = [
  {
    _id: "c1",
    _creationTime: 1,
    name: "MDLZ Montornes",
    code: "MDLZ_MON",
    address: "Calle Raiguer 1",
  },
];

function renderAdmin() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <AdminWorkspaceShell />
      </I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.results = {
    "fichaTypes:listTypesAdmin": TYPES,
    "fichas:listAll": FICHAS,
    "access:listCenters": CENTERS,
    "fichaTypes:listTypes": TYPES,
    "traducciones:listTranslations": [],
  };
  h.skips = [];
});

describe("pestaña Administración", () => {
  test("ofrece las dos sub-pestañas y pinta la lista de tipos sin abrir el diálogo", () => {
    renderAdmin();

    // «Tipos de ficha» lo llevan también el título de la vista y el disparador
    // del diálogo de tipos; el conmutador es uno de esos botones. La sub-
    // pestaña «Fichas» es única, y es la que prueba el conmutador de verdad.
    expect(
      screen.getAllByRole("button", { name: "Tipos de ficha" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Fichas" })).toBeTruthy();

    // La lista de tipos se ve en la propia pestaña, no sólo dentro del
    // diálogo: nombre, origen y recuento de uso.
    // El origen y el recuento comparten párrafo («Tipo de serie · 1 fichas»),
    // así que se buscan por subcadena y no por igualdad exacta.
    expect(screen.getByText(/Tipo de serie/)).toBeTruthy();
    expect(screen.getByText(/Creado por admin/)).toBeTruthy();
    expect(screen.getAllByText(/1 fichas/).length).toBe(2);
  });

  test("al pasar a «Fichas» se llega al listado del administrador", () => {
    renderAdmin();

    fireEvent.click(screen.getByRole("button", { name: "Fichas" }));

    // La rejilla de administración carga sus fichas: título y acciones.
    expect(screen.getByText("Detergente desinfectante")).toBeTruthy();
    expect(screen.getByText("Editar")).toBeTruthy();
  });

  test("la vista de fichas no pide traducciones mientras el interruptor siga apagado", () => {
    renderAdmin();

    fireEvent.click(screen.getByRole("button", { name: "Fichas" }));

    expect(h.skips).toContain("traducciones:listTranslations");
  });
});
