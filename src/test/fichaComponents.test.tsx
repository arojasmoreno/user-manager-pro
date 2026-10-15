import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { FichaType } from "@/lib/fichaTypes";

/**
 * Los subcomponentes de fichas se identifican por su **referencia** de Convex,
 * no por orden de llamada: aquí se sustituye el proxy generado por un objeto con
 * nombres estables, de modo que cada test controla la mutación que le interesa
 * sin depender de en qué orden se rendericen los hijos.
 */
vi.mock("@/convex/_generated/api", () => ({
  api: {
    fichas: {
      create: "fichas:create",
      update: "fichas:update",
      remove: "fichas:remove",
    },
    traducciones: {
      listByFicha: "traducciones:listByFicha",
      listTranslations: "traducciones:listTranslations",
      saveTranslation: "traducciones:saveTranslation",
      deleteTranslation: "traducciones:deleteTranslation",
    },
    traduccionesAi: { translateFicha: "traduccionesAi:translateFicha" },
  },
}));

const h = vi.hoisted(() => ({
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  actions: {} as Record<string, ReturnType<typeof vi.fn>>,
  toasts: { success: [] as string[], error: [] as string[] },
  supabaseConfigured: false,
  upload: vi.fn(),
  publicUrl: "https://cdn.example.com/fichas/subido.pdf",
}));

vi.mock("convex/react", () => ({
  useMutation: (ref: string) => {
    h.mutations[ref] ??= vi.fn().mockResolvedValue(null);
    return h.mutations[ref];
  },
  useAction: (ref: string) => {
    h.actions[ref] ??= vi.fn().mockResolvedValue(null);
    return h.actions[ref];
  },
  useQuery_experimental: () => ({ status: "success", data: [] }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (message: string) => h.toasts.success.push(message),
    error: (message: string) => h.toasts.error.push(message),
  },
}));

vi.mock("@/lib/supabase", () => ({
  get isSupabaseConfigured() {
    return h.supabaseConfigured;
  },
  // El cliente real solo se usa para subir y pedir la URL pública.
  get supabase() {
    return {
      storage: {
        from: () => ({
          upload: h.upload,
          getPublicUrl: () => ({ data: { publicUrl: h.publicUrl } }),
        }),
      },
    };
  },
  FICHAS_BUCKET: "fichas",
}));

import { CenterPicker } from "@/components/fichas/CenterPicker";
import { DeleteFichaButton } from "@/components/fichas/DeleteFichaButton";
import { DocumentSource } from "@/components/fichas/DocumentSource";
import { FichaCard } from "@/components/fichas/FichaCard";
import { FichaFilters } from "@/components/fichas/FichaFilters";

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
] as unknown as Doc<"workCenters">[];

const FICHA = {
  _id: "f1",
  _creationTime: 3,
  title: "Detergente desinfectante",
  kind: "ficha_tecnica",
  productName: "Hypofoam",
  manufacturer: "Diversey",
  url: "https://example.com/a.pdf",
  workCenterIds: ["c1"],
  active: true,
} as unknown as Doc<"fichas">;

const TIPO_TECNICA: FichaType = {
  slug: "ficha_tecnica",
  name: "Ficha técnica",
  icon: "file-text",
  order: 10,
  builtIn: true,
  hidden: false,
};

const TIPO_PERMISO: FichaType = {
  slug: "permiso_trabajo",
  name: "Permiso de trabajo",
  icon: "clipboard-list",
  order: 50,
  builtIn: false,
  hidden: false,
};

/** Traducción al día: se muestra lo mismo que la ficha guardada. */
const sinCambios = (ficha: {
  title: string;
  productName?: string;
  manufacturer?: string;
}) => ({
  title: ficha.title,
  productName: ficha.productName,
  manufacturer: ficha.manufacturer,
  isFallback: false,
});

/** Ficha que aún no está traducida al idioma activo. */
const sinTraducir = () => ({
  title: "Detergent disinfectant",
  productName: "Hypofoam",
  manufacturer: "Diversey",
  isFallback: true,
});

beforeEach(() => {
  h.mutations = {};
  h.actions = {};
  h.toasts.success = [];
  h.toasts.error = [];
  h.supabaseConfigured = false;
  h.upload.mockReset();
  h.upload.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CenterPicker", () => {
  test("sin centros explica dónde hay que crearlos", () => {
    render(<CenterPicker centers={[]} selected={[]} onToggle={vi.fn()} />);

    expect(
      screen.getByText(/Crea primero un centro de trabajo en la pestaña «Centros»/),
    ).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("al pulsar un centro avisa con su identificador", () => {
    const onToggle = vi.fn();
    render(<CenterPicker centers={CENTERS} selected={[]} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: "Granollers" }));

    expect(onToggle).toHaveBeenCalledWith("c2");
  });

  test("resalta los centros ya elegidos y deja el resto en segundo plano", () => {
    render(
      <CenterPicker
        centers={CENTERS}
        selected={["c1"] as unknown as Id<"workCenters">[]}
        onToggle={vi.fn()}
      />,
    );

    const elegido = screen.getByRole("button", { name: "MDLZ Montornes" });
    const libre = screen.getByRole("button", { name: "Granollers" });

    // Es la única señal visible de selección que ofrece el componente.
    expect(elegido.className).toContain("bg-primary");
    expect(libre.className).not.toContain("bg-primary");
  });
});

describe("FichaFilters", () => {
  test("lista «Todas», cada tipo y su recuento", () => {
    render(
      <FichaFilters
        search=""
        onSearchChange={vi.fn()}
        filter="all"
        onFilterChange={vi.fn()}
        railTypes={[TIPO_TECNICA, TIPO_PERMISO]}
        countOf={(slug) => (slug === "ficha_tecnica" ? 2 : 1)}
      />,
    );

    expect(screen.getByRole("button", { name: "Todas" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Ficha técnica/ }).textContent,
    ).toBe("Ficha técnica2");
    expect(
      screen.getByRole("button", { name: /Permiso de trabajo/ }).textContent,
    ).toBe("Permiso de trabajo1");
  });

  test("cambia de tipo y vuelve a «Todas»", () => {
    const onFilterChange = vi.fn();
    render(
      <FichaFilters
        search=""
        onSearchChange={vi.fn()}
        filter="ficha_tecnica"
        onFilterChange={onFilterChange}
        railTypes={[TIPO_TECNICA, TIPO_PERMISO]}
        countOf={() => 1}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Permiso de trabajo/ }));
    expect(onFilterChange).toHaveBeenLastCalledWith("permiso_trabajo");

    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    expect(onFilterChange).toHaveBeenLastCalledWith("all");
  });

  test("escribe en el buscador", () => {
    const onSearchChange = vi.fn();
    render(
      <FichaFilters
        search=""
        onSearchChange={onSearchChange}
        filter="all"
        onFilterChange={vi.fn()}
        railTypes={[]}
        countOf={() => 0}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("Buscar por título, producto o fabricante…"),
      { target: { value: "hipofoam" } },
    );

    expect(onSearchChange).toHaveBeenCalledWith("hipofoam");
  });
});

describe("FichaCard", () => {
  function renderCard(
    overrides: Partial<Parameters<typeof FichaCard>[0]> = {},
  ) {
    return render(
      <FichaCard
        ficha={FICHA}
        types={[TIPO_TECNICA]}
        icon={<span data-testid="icono" />}
        iconTone="bg-muted"
        myCenters={CENTERS}
        centerNames={() => ["MDLZ Montornes"]}
        translateFicha={sinCambios}
        isAdmin={false}
        {...overrides}
      />,
    );
  }

  test("pinta el título, el producto con su fabricante y los centros", () => {
    renderCard();

    expect(screen.getByText("Detergente desinfectante")).toBeTruthy();
    expect(screen.getByText("Hypofoam · Diversey")).toBeTruthy();
    expect(screen.getByText("MDLZ Montornes")).toBeTruthy();
    expect(screen.getByText("Ficha técnica")).toBeTruthy();
    expect(screen.getByTestId("icono")).toBeTruthy();
  });

  test("el enlace al documento abre en otra pestaña sin filtrar el referrer", () => {
    renderCard();

    const link = screen.getByRole("link", { name: /Abrir documento/ });
    expect(link.getAttribute("href")).toBe("https://example.com/a.pdf");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  test("sin producto y sin fabricante no deja una línea vacía", () => {
    renderCard({ translateFicha: () => ({ title: "Solo título", isFallback: false }) });

    expect(screen.getByText("Solo título")).toBeTruthy();
    expect(screen.queryByText(/·/)).toBeNull();
  });

  test("un usuario normal no ve los botones de administrador", () => {
    renderCard();

    expect(screen.queryByRole("button")).toBeNull();
  });

  test("el administrador ve editar y borrar", () => {
    renderCard({ isAdmin: true });

    expect(screen.getByText("Editar")).toBeTruthy();
    // Editar + borrar (el borrado es un botón de solo icono).
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  test("solo el administrador ve el aviso de ficha sin traducir", () => {
    const { unmount } = renderCard({
      isAdmin: true,
      translateFicha: sinTraducir,
    });
    expect(screen.getByText("Sin traducir")).toBeTruthy();
    unmount();

    renderCard({ isAdmin: false, translateFicha: sinTraducir });
    expect(screen.queryByText("Sin traducir")).toBeNull();
    // El usuario ve la traducción, sin el aviso interno.
    expect(screen.getByText("Detergent disinfectant")).toBeTruthy();
  });
});

describe("DeleteFichaButton", () => {
  test("no borra nada si no se confirma", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<DeleteFichaButton fichaId={"f1" as never} />);

    fireEvent.click(screen.getByRole("button"));

    // La mutación existe (se registra al renderizar), pero no se llega a usar.
    expect(h.mutations["fichas:remove"]).not.toHaveBeenCalled();
    expect(h.toasts.success).toEqual([]);
  });

  test("borra la ficha tras confirmar", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DeleteFichaButton fichaId={"f1" as never} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(h.mutations["fichas:remove"]).toHaveBeenCalledWith({
        fichaId: "f1",
      }),
    );
    expect(h.toasts.success).toEqual(["Ficha eliminada."]);
  });

  test("enseña el error del servidor en lugar de fallar en silencio", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DeleteFichaButton fichaId={"f1" as never} />);
    h.mutations["fichas:remove"].mockRejectedValueOnce(
      new Error("La ficha tiene traducciones pendientes"),
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(h.toasts.error).toEqual(["La ficha tiene traducciones pendientes"]),
    );
    expect(h.toasts.success).toEqual([]);
  });
});

describe("DocumentSource", () => {
  test("avisa de cada cambio en la URL", () => {
    const onUrlChange = vi.fn();
    render(<DocumentSource url="" onUrlChange={onUrlChange} />);

    fireEvent.change(screen.getByPlaceholderText("https://… o sube un PDF"), {
      target: { value: "https://example.com/b.pdf" },
    });

    expect(onUrlChange).toHaveBeenCalledWith("https://example.com/b.pdf");
  });

  test("sin Supabase la subida está desactivada y explica por qué", () => {
    render(<DocumentSource url="" onUrlChange={vi.fn()} />);

    const boton = screen.getByRole("button");
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    expect(boton.getAttribute("title")).toMatch(/Configura Supabase/);
    expect(screen.getByText(/Subida de archivos disponible al añadir/)).toBeTruthy();
  });

  test("con Supabase sube el archivo y propone su URL pública", async () => {
    h.supabaseConfigured = true;
    const onUrlChange = vi.fn();
    const { container } = render(
      <DocumentSource url="" onUrlChange={onUrlChange} />,
    );

    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: {
        files: [new File(["%PDF"], "Ficha Técnica.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() => expect(h.upload).toHaveBeenCalledTimes(1));
    const [path, file] = h.upload.mock.calls[0] as [string, File];
    // El nombre se sanea antes de subirlo.
    expect(path).toMatch(/^\d+-Ficha_T_cnica\.pdf$/);
    expect(file.name).toBe("Ficha Técnica.pdf");
    expect(onUrlChange).toHaveBeenCalledWith(h.publicUrl);
    expect(h.toasts.success).toEqual([
      "Documento subido. Recuerda guardar la ficha.",
    ]);
  });

  test("si el almacenamiento falla lo cuenta con su motivo", async () => {
    h.supabaseConfigured = true;
    h.upload.mockResolvedValueOnce({ error: new Error("bucket lleno") });
    const { container } = render(
      <DocumentSource url="" onUrlChange={vi.fn()} />,
    );

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["%PDF"], "a.pdf")] },
    });

    await waitFor(() =>
      expect(h.toasts.error).toEqual(["No se pudo subir: bucket lleno"]),
    );
  });
});
