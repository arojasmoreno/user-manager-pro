import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Doc } from "@/convex/_generated/dataModel";
import type { FichaType } from "@/lib/fichaTypes";

/**
 * Diálogos extraídos del catálogo. Cada mutación se identifica por su nombre
 * (`fichas:create`, `fichas:update`) en lugar de por orden de llamada, así que
 * los tests no dependen de cuántos hooks monte cada hijo.
 */
vi.mock("@/convex/_generated/api", () => ({
  api: {
    fichas: { create: "fichas:create", update: "fichas:update", remove: "fichas:remove" },
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
  /** Argumentos con los que se pidió la consulta: `"skip"` o los args reales. */
  queryArgs: [] as unknown[],
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
  useQuery_experimental: ({ args }: { args: unknown }) => {
    h.queryArgs.push(args);
    return { status: "success", data: [] };
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (message: string) => h.toasts.success.push(message),
    error: (message: string) => h.toasts.error.push(message),
  },
}));

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: false,
  supabase: null,
  FICHAS_BUCKET: "fichas",
}));

import { CreateFichaDialog } from "@/components/fichas/CreateFichaDialog";
import { EditFichaDialog } from "@/components/fichas/EditFichaDialog";

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

beforeEach(() => {
  h.mutations = {};
  h.actions = {};
  h.toasts.success = [];
  h.toasts.error = [];
  h.queryArgs = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Abre el diálogo. El contenido (y sus campos) no existe en el DOM hasta que se
 * abre, así que hay que pulsar el disparador antes de tocar el formulario.
 */
function openDialog(trigger: string) {
  fireEvent.click(screen.getByText(trigger));
}

/**
 * El botón de enviar del pie del diálogo. Comparte texto con el disparador, que
 * sigue en el documento, así que se toma el último.
 */
function submitButton(label: string) {
  const matches = screen.getAllByText(label);
  return matches[matches.length - 1] as HTMLButtonElement;
}

describe("CreateFichaDialog", () => {
  function renderCreate(overrides: Partial<Parameters<typeof CreateFichaDialog>[0]> = {}) {
    return render(
      <CreateFichaDialog centers={CENTERS} types={[TIPO_TECNICA, TIPO_PERMISO]} {...overrides} />,
    );
  }

  test("no crea nada si falta el nombre, el documento o los centros", async () => {
    renderCreate();
    openDialog("Añadir ficha");

    fireEvent.click(submitButton("Añadir ficha"));

    await waitFor(() =>
      expect(h.toasts.error).toEqual([
        "Completa el tipo, el nombre, el documento y al menos un centro de trabajo.",
      ]),
    );
    expect(h.mutations["fichas:create"]).not.toHaveBeenCalled();
  });

  test("sin centros no deja enviar y remite a la pestaña Centros", () => {
    renderCreate({ centers: [] });
    openDialog("Añadir ficha");
    const enviar = submitButton("Añadir ficha");

    expect(enviar.disabled).toBe(true);
    expect(
      screen.getByText(/Crea primero un centro de trabajo en la pestaña «Centros»/),
    ).toBeTruthy();
  });

  test("sin tipos activos lo explica antes de empezar", () => {
    renderCreate({ types: [] });
    openDialog("Añadir ficha");
    const enviar = submitButton("Añadir ficha");

    expect(enviar.disabled).toBe(true);
    expect(
      screen.getByText(/No hay ningún tipo de ficha activo/),
    ).toBeTruthy();
  });

  test("crea la ficha con los datos recortados y el primer tipo por defecto", async () => {
    renderCreate();
    openDialog("Añadir ficha");
    fireEvent.change(
      screen.getByPlaceholderText("Disolvente industrial — revisión 2"),
      { target: { value: "  Disolvente industrial  " } },
    );
    fireEvent.click(screen.getByRole("button", { name: "MDLZ Montornes" }));
    fireEvent.change(screen.getByPlaceholderText("Tornillo de bancada 400 V"), {
      target: { value: " Tornillo 400 V " },
    });
    fireEvent.change(screen.getByPlaceholderText("Nombre del fabricante"), {
      target: { value: " Acme " },
    });
    fireEvent.change(screen.getByPlaceholderText("https://… o sube un PDF"), {
      target: { value: " https://example.com/a.pdf " },
    });

    fireEvent.click(submitButton("Añadir ficha"));

    await waitFor(() =>
      expect(h.mutations["fichas:create"]).toHaveBeenCalledWith({
        title: "Disolvente industrial",
        kind: "ficha_tecnica",
        productName: "Tornillo 400 V",
        manufacturer: "Acme",
        url: "https://example.com/a.pdf",
        workCenterIds: ["c1"],
      }),
    );
    expect(h.toasts.success).toEqual(["Ficha añadida al catálogo."]);
    // Al guardar, el diálogo se cierra.
    expect(screen.queryByText("Nueva ficha")).toBeNull();

    // Y al reabrirlo el formulario está limpio, sin arrastrar lo anterior.
    openDialog("Añadir ficha");
    const titulo = screen.getByPlaceholderText(
      "Disolvente industrial — revisión 2",
    ) as HTMLInputElement;
    expect(titulo.value).toBe("");
    expect(
      screen.getByRole("button", { name: "Granollers" }).className,
    ).not.toContain("bg-primary");
  });

  test("deja el producto y el fabricante sin definir si están vacíos", async () => {
    renderCreate();
    openDialog("Añadir ficha");
    fireEvent.change(
      screen.getByPlaceholderText("Disolvente industrial — revisión 2"),
      { target: { value: "Solo lo esencial" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Granollers" }));
    fireEvent.change(screen.getByPlaceholderText("https://… o sube un PDF"), {
      target: { value: "https://example.com/b.pdf" },
    });

    fireEvent.click(submitButton("Añadir ficha"));

    await waitFor(() =>
      expect(h.mutations["fichas:create"]).toHaveBeenCalledWith({
        title: "Solo lo esencial",
        kind: "ficha_tecnica",
        productName: undefined,
        manufacturer: undefined,
        url: "https://example.com/b.pdf",
        workCenterIds: ["c2"],
      }),
    );
  });

  test("enseña el error del servidor y no cierra el diálogo", async () => {
    h.mutations["fichas:create"] = vi
      .fn()
      .mockResolvedValue(null)
      .mockRejectedValueOnce(new Error("El documento ya existe"));
    renderCreate();
    openDialog("Añadir ficha");
    fireEvent.change(
      screen.getByPlaceholderText("Disolvente industrial — revisión 2"),
      { target: { value: "Duplicada" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "MDLZ Montornes" }));
    fireEvent.change(screen.getByPlaceholderText("https://… o sube un PDF"), {
      target: { value: "https://example.com/a.pdf" },
    });

    fireEvent.click(submitButton("Añadir ficha"));

    await waitFor(() =>
      expect(h.toasts.error).toEqual(["El documento ya existe"]),
    );
    expect(screen.getByText("Nueva ficha")).toBeTruthy();
  });
});

describe("EditFichaDialog", () => {
  function renderEdit(
    overrides: Partial<Parameters<typeof EditFichaDialog>[0]> = {},
  ) {
    return render(
      <EditFichaDialog
        ficha={FICHA}
        centers={CENTERS}
        types={[TIPO_TECNICA, TIPO_PERMISO]}
        {...overrides}
      />,
    );
  }

  test("abre con los valores guardados", () => {
    renderEdit();
    fireEvent.click(screen.getByText("Editar"));

    expect(screen.getByDisplayValue("Detergente desinfectante")).toBeTruthy();
    expect(screen.getByDisplayValue("Hypofoam")).toBeTruthy();
    expect(screen.getByDisplayValue("Diversey")).toBeTruthy();
    expect(screen.getByDisplayValue("https://example.com/a.pdf")).toBeTruthy();
    // La descripción traduce el tipo de la ficha.
    expect(
      document.querySelector('[data-slot="dialog-description"]')?.textContent,
    ).toBe("Ficha técnica");
    // El centro guardado llega ya marcado en el selector de centros.
    expect(
      screen.getByRole("button", { name: "MDLZ Montornes" }).className,
    ).toContain("bg-primary");
  });

  test("guarda los cambios con el centro elegido", async () => {
    renderEdit();
    fireEvent.click(screen.getByText("Editar"));
    fireEvent.change(screen.getByDisplayValue("Detergente desinfectante"), {
      target: { value: " Detergente desinfectante v2 " },
    });
    // Se añade Granollers al centro que ya tenía.
    fireEvent.click(screen.getByRole("button", { name: "Granollers" }));

    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() =>
      expect(h.mutations["fichas:update"]).toHaveBeenCalledWith({
        fichaId: "f1",
        title: "Detergente desinfectante v2",
        kind: "ficha_tecnica",
        productName: "Hypofoam",
        manufacturer: "Diversey",
        url: "https://example.com/a.pdf",
        workCenterIds: ["c1", "c2"],
      }),
    );
    expect(h.toasts.success).toEqual(["Ficha actualizada."]);
  });

  test("se vuelve a sembrar el formulario cada vez que se abre", () => {
    renderEdit();
    fireEvent.click(screen.getByText("Editar"));
    fireEvent.change(screen.getByDisplayValue("Detergente desinfectante"), {
      target: { value: "Cambio sin guardar" },
    });
    fireEvent.click(screen.getByText("Cancelar"));

    fireEvent.click(screen.getByText("Editar"));

    // No se arrastra el borrador anterior.
    expect(screen.getByDisplayValue("Detergente desinfectante")).toBeTruthy();
    expect(screen.queryByDisplayValue("Cambio sin guardar")).toBeNull();
  });

  test("mantiene el tipo actual aunque ya no esté en el catálogo", async () => {
    const fichaRetirada = { ...FICHA, kind: "permiso_trabajo" } as unknown as Doc<"fichas">;
    renderEdit({ ficha: fichaRetirada, types: [TIPO_TECNICA] });

    fireEvent.click(screen.getByText("Editar"));
    // El tipo retirado se muestra por su identificador, porque ya no hay
    // etiqueta en el catálogo que lo traduzca.
    expect(screen.getAllByText("permiso_trabajo").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() =>
      expect(h.mutations["fichas:update"]).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "permiso_trabajo" }),
      ),
    );
  });

  test("solo pide las traducciones cuando el diálogo está abierto", () => {
    renderEdit();

    // Cerrado, el panel de traducciones ni siquiera está montado.
    expect(h.queryArgs).toEqual([]);

    fireEvent.click(screen.getByText("Editar"));

    expect(h.queryArgs).toEqual([{ fichaId: "f1" }]);
  });

  test("enseña el error del servidor al guardar", async () => {
    h.mutations["fichas:update"] = vi
      .fn()
      .mockResolvedValue(null)
      .mockRejectedValueOnce(new Error("Ese tipo de ficha no existe"));
    renderEdit();
    fireEvent.click(screen.getByText("Editar"));

    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() =>
      expect(h.toasts.error).toEqual(["Ese tipo de ficha no existe"]),
    );
    expect(h.toasts.success).toEqual([]);
  });
});
