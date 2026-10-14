import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

type QueryResult =
  | { status: "pending" }
  | { status: "success"; data: unknown }
  | { status: "error"; error: Error };

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  failure: null as Error | null,
  translate: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  mutationIndex: 0,
  toasts: { success: [] as string[], error: [] as string[] },
}));

vi.mock("convex/react", () => ({
  useQuery_experimental: (): QueryResult => {
    if (h.failure) return { status: "error", error: h.failure };
    return { status: "success", data: h.rows };
  },
  useAction: () => h.translate,
  // El panel pide dos mutaciones, siempre en este orden: guardar y quitar.
  useMutation: () => {
    h.mutationIndex += 1;
    return h.mutationIndex % 2 === 1 ? h.save : h.remove;
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (message: string) => h.toasts.success.push(message),
    error: (message: string) => h.toasts.error.push(message),
  },
}));

import { FichaTranslations } from "@/components/FichaTranslations";
import type { Id } from "@/convex/_generated/dataModel";

const FICHA_ID = "f1" as Id<"fichas">;

beforeEach(() => {
  h.rows = [];
  h.failure = null;
  h.mutationIndex = 0;
  h.translate.mockReset();
  h.translate.mockResolvedValue({});
  h.save.mockReset();
  h.save.mockResolvedValue(null);
  h.remove.mockReset();
  h.remove.mockResolvedValue(null);
  h.toasts.success = [];
  h.toasts.error = [];
});

function renderPanel() {
  return render(<FichaTranslations fichaId={FICHA_ID} enabled />);
}

describe("panel de traducciones de una ficha", () => {
  test("lista los idiomas pedidos y marca los que faltan", () => {
    h.rows = [
      {
        locale: "fr-FR",
        title: "Détergent désinfectant",
        productName: "Hypofoam",
        source: "ai",
      },
    ];
    renderPanel();

    expect(screen.getByText("Français")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("العربية")).toBeTruthy();
    expect(screen.getByText("Mandinka")).toBeTruthy();
    expect(screen.getByText(/Détergent désinfectant/)).toBeTruthy();
    expect(screen.getByText("IA")).toBeTruthy();
    // Los tres idiomas sin traducción se ofrecen en bloque.
    expect(screen.getByText("Traducir los 3 que faltan")).toBeTruthy();
  });

  test("avisa cuando la consulta de traducciones falla", () => {
    h.failure = new Error("sin conexión");
    renderPanel();
    expect(screen.getByText(/No se han podido cargar las traducciones/)).toBeTruthy();
  });

  test("traduce con la IA el idioma que se le pide", async () => {
    renderPanel();

    const buttons = screen.getAllByText("Traducir con IA");
    fireEvent.click(buttons[0]);

    await waitFor(() =>
      expect(h.translate).toHaveBeenCalledWith({
        fichaId: FICHA_ID,
        locale: "fr-FR",
      }),
    );
    expect(h.toasts.success[0]).toMatch(/Français/);
  });

  test("traduce de una vez todos los idiomas que faltan", async () => {
    renderPanel();

    fireEvent.click(screen.getByText("Traducir los 4 que faltan"));

    await waitFor(() => expect(h.translate).toHaveBeenCalledTimes(4));
    expect(h.translate.mock.calls.map(([args]) => args.locale)).toEqual([
      "fr-FR",
      "en-GB",
      "ar-MA",
      "mnk",
    ]);
  });

  test("enseña el error de la IA en lugar de dejarlo pasar", async () => {
    h.translate.mockRejectedValue(
      new Error("Falta la clave de la IA. Añade GOOGLE_API_KEY."),
    );
    renderPanel();

    fireEvent.click(screen.getAllByText("Traducir con IA")[0]);

    await waitFor(() =>
      expect(h.toasts.error[0]).toMatch(/Falta la clave de la IA/),
    );
  });

  test("permite escribir la traducción a mano", async () => {
    renderPanel();

    fireEvent.click(screen.getAllByText("Escribir a mano")[0]);
    fireEvent.change(screen.getByPlaceholderText("Título traducido"), {
      target: { value: "Détergent désinfectant" },
    });
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() =>
      expect(h.save).toHaveBeenCalledWith({
        fichaId: FICHA_ID,
        locale: "fr-FR",
        title: "Détergent désinfectant",
        productName: undefined,
        manufacturer: undefined,
      }),
    );
  });

  test("no guarda una traducción sin título", async () => {
    renderPanel();

    fireEvent.click(screen.getAllByText("Escribir a mano")[0]);
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() =>
      expect(h.toasts.error[0]).toMatch(/no puede estar vacío/),
    );
    expect(h.save).not.toHaveBeenCalled();
  });

  test("quita una traducción existente tras confirmar", async () => {
    h.rows = [
      { locale: "mnk", title: "Version uno", source: "manual" },
    ];
    const confirm = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => true);
    renderPanel();

    fireEvent.click(screen.getByTitle("Quitar la traducción"));

    await waitFor(() =>
      expect(h.remove).toHaveBeenCalledWith({
        fichaId: FICHA_ID,
        locale: "mnk",
      }),
    );
    confirm.mockRestore();
  });
});
