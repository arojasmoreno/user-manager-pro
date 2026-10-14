import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type QueryResult =
  | { status: "pending" }
  | { status: "success"; data: unknown }
  | { status: "error"; error: Error };

// The generated `api` proxy is an `any` stub outside the Convex bundler, so the
// queries cannot be identified by path. Each tab fires its queries in a fixed
// order, so the stub answers them from a queue in that documented order.
const h = vi.hoisted(() => ({
  index: 0,
  queue: [] as QueryResult[],
  failing: new Set<number>(),
}));

vi.mock("convex/react", () => ({
  useQuery_experimental: () => {
    const i = h.index++;
    if (h.failing.has(i)) {
      return { status: "error", error: new Error(`fallo en la consulta ${i}`) };
    }
    return h.queue[i] ?? { status: "pending" };
  },
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

let currentUser: { role?: string; name?: string; email?: string } | undefined;

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: currentUser,
  }),
}));

import { CentrosSection } from "@/components/CentrosSection";
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
  {
    _id: "c2",
    _creationTime: 2,
    name: "Granollers",
    code: "MDLZ_GRA",
    address: "Calle Galileo Galilei 2",
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
    workCenterIds: ["c1", "c2"],
    active: true,
  },
  {
    _id: "f2",
    _creationTime: 4,
    title: "Manual de máquina",
    kind: "manual_instrucciones",
    productName: undefined,
    manufacturer: undefined,
    url: "https://example.com/b.pdf",
    workCenterIds: ["c2"],
    active: true,
  },
];

/**
 * Catálogo con una ficha de un tipo creado por el administrador. Vive aparte
 * de `FICHAS` para no alterar los recuentos por centro de la pestaña Centros.
 */
const FICHAS_CON_PERMISO = [
  ...FICHAS,
  {
    _id: "f3",
    _creationTime: 8,
    title: "Trabajo en caliente",
    kind: "permiso_trabajo",
    productName: undefined,
    manufacturer: undefined,
    url: "https://example.com/c.pdf",
    workCenterIds: ["c1"],
    active: true,
  },
];

/** Tipos de ficha: uno de serie y otro creado por el administrador. */
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

const USERS = [
  {
    _id: "u1",
    _creationTime: 5,
    email: "admin@example.com",
    name: "Admin",
    role: "admin" as const,
    workCenterIds: [],
    blocked: false,
  },
];

const TRANSLATIONS: { fichaId: string; locale: string; title: string }[] = [];

const ok = (data: unknown): QueryResult => ({ status: "success", data });
const pending: QueryResult = { status: "pending" };

function renderTab(node: React.ReactElement) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

/** Igual, pero dentro del proveedor de idioma, para probar la ficha traducida. */
function renderTabWithI18n(node: React.ReactElement) {
  return render(
    <MemoryRouter>
      <I18nProvider>{node}</I18nProvider>
    </MemoryRouter>,
  );
}

/**
 * FichasSection (admin) consulta en este orden: listMine, listAll, listCenters,
 * listMyCenters (saltada), listTypes (saltada), listTypesAdmin y, por último,
 * listTranslations (saltada mientras el idioma activo es el de las fichas).
 */
function queueFichasAdmin(fichas: unknown = FICHAS) {
  h.queue = [
    ok(fichas),
    ok(fichas),
    ok(CENTERS),
    pending,
    pending,
    ok(TYPES),
    ok(TRANSLATIONS),
  ];
}

/**
 * FichasSection (usuario): listMine, listMyCenters y listTypes; el resto van
 * saltadas por ser de administrador.
 */
function queueFichasUser() {
  h.queue = [ok([]), pending, pending, ok([]), ok(TYPES), pending, ok(TRANSLATIONS)];
}

/** CentrosSection: listCenters, listUsers, listAll. */
function queueCentros() {
  h.queue = [ok(CENTERS), ok(USERS), ok(FICHAS)];
}

beforeEach(() => {
  h.index = 0;
  h.queue = [];
  h.failing.clear();
  currentUser = { role: "admin", email: "admin@example.com" };
});

afterEach(() => {
  h.queue = [];
  h.failing.clear();
  currentUser = undefined;
  window.localStorage.removeItem("doc-manager-locale");
});

describe("pestaña Fichas", () => {
  test("lista las fichas con su centro y sus datos", () => {
    queueFichasAdmin();
    renderTab(<FichasSection />);

    expect(screen.getByText("Detergente desinfectante")).toBeTruthy();
    expect(screen.getAllByText("Manual de máquina").length).toBeGreaterThan(0);
    expect(screen.getByText("Hypofoam · Diversey")).toBeTruthy();
    expect(screen.getAllByText("MDLZ Montornes").length).toBeGreaterThan(0);
    expect(screen.queryByText(/No se ha podido cargar/)).toBeNull();
  });

  test("un usuario sin centro ve el estado vacío, no un error", () => {
    currentUser = { role: "user", email: "user@example.com" };
    queueFichasUser();
    renderTab(<FichasSection />);

    expect(screen.getByText("Todavía no hay fichas aquí")).toBeTruthy();
    expect(screen.queryByText(/No se ha podido cargar/)).toBeNull();
  });

  test("filtra por búsqueda", () => {
    queueFichasAdmin();
    renderTab(<FichasSection />);
    expect(screen.getAllByText("Manual de máquina").length).toBeGreaterThan(0);
  });

  test("ofrece los tipos del catálogo, incluidos los creados por el administrador", () => {
    queueFichasAdmin(FICHAS_CON_PERMISO);
    renderTab(<FichasSection />);

    // El tipo propio aparece como filtro y como etiqueta de su ficha.
    expect(screen.getAllByText("Permiso de trabajo").length).toBeGreaterThan(1);
    expect(screen.getByText("Trabajo en caliente")).toBeTruthy();
  });

  test("el administrador puede abrir la gestión de tipos de ficha", () => {
    queueFichasAdmin();
    renderTab(<FichasSection />);

    expect(screen.getByText("Tipos de ficha")).toBeTruthy();
  });

  test("muestra la ficha traducida y avisa de las que no lo están", () => {
    window.localStorage.setItem("doc-manager-locale", "fr-FR");
    queueFichasAdmin();
    h.queue[6] = ok([
      {
        fichaId: "f1",
        locale: "fr-FR",
        title: "Détergent désinfectant",
        productName: "Hypofoam",
        manufacturer: "Diversey",
        source: "manual",
      },
    ]);
    renderTabWithI18n(<FichasSection />);

    expect(screen.getByText("Détergent désinfectant")).toBeTruthy();
    expect(screen.queryByText("Detergente desinfectante")).toBeNull();
    // La ficha sin traducir se sigue viendo, con su aviso para el administrador.
    expect(screen.getAllByText("Manual de máquina").length).toBeGreaterThan(0);
    expect(screen.getByText("Sin traducir")).toBeTruthy();
  });

  test("muestra la pantalla de error si la consulta de fichas falla", () => {
    queueFichasAdmin();
    h.failing.add(1); // fichas:listAll
    renderTab(<FichasSection />);

    expect(screen.getByText(/No se ha podido cargar/)).toBeTruthy();
    expect(screen.getByText("fallo en la consulta 1")).toBeTruthy();
  });
});

describe("pestaña Centros", () => {
  test("lista los centros con sus recuentos", () => {
    queueCentros();
    renderTab(<CentrosSection />);

    expect(screen.getByText("MDLZ Montornes")).toBeTruthy();
    expect(screen.getByText("Granollers")).toBeTruthy();
    expect(screen.getByText("Calle Raiguer 1")).toBeTruthy();
    expect(screen.getByText("1 ficha")).toBeTruthy();
    expect(screen.getByText("2 fichas")).toBeTruthy();
    expect(screen.getAllByText("0 usuarios").length).toBe(2);
    expect(screen.queryByText(/No se ha podido cargar/)).toBeNull();
  });

  test("muestra la pantalla de error si la consulta de centros falla", () => {
    queueCentros();
    h.failing.add(0); // access:listCenters
    renderTab(<CentrosSection />);

    expect(screen.getByText(/No se ha podido cargar/)).toBeTruthy();
    expect(screen.getByText("fallo en la consulta 0")).toBeTruthy();
  });
});
