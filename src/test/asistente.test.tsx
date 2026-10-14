import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  ask: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: () => h.ask,
  useQuery_experimental: () => ({ status: "pending" }),
  useMutation: () => vi.fn(),
}));

import { AsistenteSection } from "@/components/AsistenteSection";
import { I18nProvider } from "@/i18n";

const RESULT = {
  answer:
    'Tienes la ficha "Detergente desinfectante" ([1]), del fabricante Diversey.',
  sources: [
    {
      _id: "f1",
      title: "Detergente desinfectante",
      kind: "ficha_tecnica",
      kindLabel: "Ficha técnica",
      url: "https://example.com/a.pdf",
      centerNames: ["MDLZ Montornes"],
    },
  ],
  catalogSize: 1,
};

beforeEach(() => {
  h.ask.mockReset();
});

describe("AsistenteSection", () => {
  test("explica qué puede hacer y ofrece ejemplos", () => {
    render(<AsistenteSection />);
    expect(screen.getByText("Pregunta sobre las fichas")).toBeTruthy();
    expect(
      screen.getByText("¿Tengo algún manual de máquina?"),
    ).toBeTruthy();
  });

  test("muestra la respuesta y la ficha de origen", async () => {
    h.ask.mockResolvedValue(RESULT);
    render(<AsistenteSection />);

    fireEvent.click(screen.getByText("¿Tengo algún manual de máquina?"));

    await waitFor(() =>
      expect(screen.getByText(/del fabricante Diversey/)).toBeTruthy(),
    );
    const source = screen.getByText("Detergente desinfectante").closest("a");
    expect(source?.getAttribute("href")).toBe("https://example.com/a.pdf");
    expect(
      screen.getByText("Ficha técnica · MDLZ Montornes"),
    ).toBeTruthy();
  });

  test("envía lo que se escribe en el campo", async () => {
    h.ask.mockResolvedValue(RESULT);
    render(<AsistenteSection />);

    const input = screen.getByPlaceholderText(
      "Escribe tu pregunta sobre las fichas…",
    );
    fireEvent.change(input, { target: { value: "¿Qué hay de limpieza?" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(h.ask).toHaveBeenCalledWith({
        question: "¿Qué hay de limpieza?",
        locale: "es-ES",
      }),
    );
    expect(screen.getByText("¿Qué hay de limpieza?")).toBeTruthy();
  });

  test("pide la respuesta en el idioma activo de la interfaz", async () => {
    window.localStorage.setItem("doc-manager-locale", "fr-FR");
    h.ask.mockResolvedValue(RESULT);
    render(
      <I18nProvider>
        <AsistenteSection />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText("¿Tengo algún manual de máquina?"));

    await waitFor(() =>
      expect(h.ask).toHaveBeenCalledWith({
        question: "¿Tengo algún manual de máquina?",
        locale: "fr-FR",
      }),
    );
    window.localStorage.removeItem("doc-manager-locale");
  });

  test("muestra el error si falta la clave de la IA", async () => {
    h.ask.mockRejectedValue(
      new Error(
        "El asistente necesita la clave de la IA. Añádela en la pestaña Keys como GOOGLE_API_KEY.",
      ),
    );
    render(<AsistenteSection />);

    fireEvent.click(screen.getByText("¿Tengo algún manual de máquina?"));

    await waitFor(() =>
      expect(screen.getByText("No se ha podido responder")).toBeTruthy(),
    );
    expect(screen.getByText(/GOOGLE_API_KEY/)).toBeTruthy();
  });

  test("avisa cuando el usuario no tiene fichas", async () => {
    h.ask.mockResolvedValue({
      answer: "Ahora mismo no hay ninguna ficha en el catálogo al que tienes acceso.",
      sources: [],
      catalogSize: 0,
    });
    render(<AsistenteSection />);

    fireEvent.click(screen.getByText("¿Tengo algún manual de máquina?"));

    await waitFor(() =>
      expect(screen.getByText(/no hay ninguna ficha/)).toBeTruthy(),
    );
    expect(screen.queryByText("Fichas usadas")).toBeNull();
  });
});
