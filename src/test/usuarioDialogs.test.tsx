import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { Doc } from "@/convex/_generated/dataModel";
import type { UserRow } from "@/components/usuarios/EditUserDialog";

/**
 * Diálogos extraídos de la pestaña Usuarios. Cada mutación se localiza por su
 * referencia de Convex, no por orden de llamada.
 */
vi.mock("@/convex/_generated/api", () => ({
  api: {
    access: {
      inviteUser: "access:inviteUser",
      updateUser: "access:updateUser",
      setUserCenters: "access:setUserCenters",
      setUserBlocked: "access:setUserBlocked",
      deleteUser: "access:deleteUser",
    },
  },
}));

const h = vi.hoisted(() => ({
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  toasts: { success: [] as string[], error: [] as string[] },
}));

vi.mock("convex/react", () => ({
  useMutation: (ref: string) => {
    h.mutations[ref] ??= vi.fn().mockResolvedValue(null);
    return h.mutations[ref];
  },
  useQuery_experimental: () => ({ status: "success", data: [] }),
  useAction: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (message: string) => h.toasts.success.push(message),
    error: (message: string) => h.toasts.error.push(message),
  },
}));

import { EditUserDialog } from "@/components/usuarios/EditUserDialog";
import { InviteDialog } from "@/components/usuarios/InviteDialog";

beforeAll(() => {
  // jsdom no implementa lo que Radix Select necesita para abrirse.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

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

function user(overrides: Partial<UserRow> = {}): UserRow {
  return {
    _id: "u1",
    _creationTime: 5,
    email: "ana@example.com",
    name: "Ana García",
    role: "user",
    workCenterIds: ["c1"],
    ...overrides,
  } as UserRow;
}

beforeEach(() => {
  h.mutations = {};
  h.toasts.success = [];
  h.toasts.error = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InviteDialog", () => {
  function renderInvite(centers: Doc<"workCenters">[] = CENTERS) {
    return render(<InviteDialog centers={centers} />);
  }

  function open() {
    fireEvent.click(screen.getByText("Añadir usuario"));
  }

  test("rechaza un correo que no lo parece", async () => {
    renderInvite();
    open();
    fireEvent.change(screen.getByPlaceholderText("ana@empresa.com"), {
      target: { value: "sin-arroba" },
    });

    fireEvent.click(screen.getByText("Enviar invitación"));

    await waitFor(() =>
      expect(h.toasts.error).toEqual(["Introduce un correo válido."]),
    );
    expect(h.mutations["access:inviteUser"]).not.toHaveBeenCalled();
  });

  test("invita con el correo normalizado y los centros marcados", async () => {
    renderInvite();
    open();
    fireEvent.change(screen.getByPlaceholderText("Ana García"), {
      target: { value: "  Ana García  " },
    });
    fireEvent.change(screen.getByPlaceholderText("ana@empresa.com"), {
      target: { value: " Nueva@Empresa.COM " },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[1]);

    fireEvent.click(screen.getByText("Enviar invitación"));

    await waitFor(() =>
      expect(h.mutations["access:inviteUser"]).toHaveBeenCalledWith({
        email: "nueva@empresa.com",
        name: "Ana García",
        role: "user",
        centerIds: ["c2"],
      }),
    );
    expect(h.toasts.success).toEqual([
      "Invitación creada. Podrá entrar con su correo cuando quiera.",
    ]);
    // Al enviar, el diálogo se cierra.
    expect(screen.queryByText(/Registra el acceso por correo/)).toBeNull();
  });

  test("sin nombre lo deja sin definir", async () => {
    renderInvite();
    open();
    fireEvent.change(screen.getByPlaceholderText("ana@empresa.com"), {
      target: { value: "nueva@empresa.com" },
    });

    fireEvent.click(screen.getByText("Enviar invitación"));

    await waitFor(() =>
      expect(h.mutations["access:inviteUser"]).toHaveBeenCalledWith(
        expect.objectContaining({ name: undefined }),
      ),
    );
  });

  test("invita como administrador y lo avisa", async () => {
    renderInvite();
    open();
    fireEvent.change(screen.getByPlaceholderText("ana@empresa.com"), {
      target: { value: "jefa@empresa.com" },
    });

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Administrador" }));

    fireEvent.click(screen.getByText("Enviar invitación"));

    await waitFor(() =>
      expect(h.mutations["access:inviteUser"]).toHaveBeenCalledWith(
        expect.objectContaining({ role: "admin" }),
      ),
    );
    expect(h.toasts.success).toEqual([
      "Invitación creada: entrará como administrador.",
    ]);
  });

  test("sin centros remite a la pestaña Centros", () => {
    renderInvite([]);
    open();

    expect(
      screen.getByText(/Todavía no hay centros. Créalos en la pestaña «Centros»/),
    ).toBeTruthy();
  });

  test("enseña el error del servidor", async () => {
    h.mutations["access:inviteUser"] = vi
      .fn()
      .mockResolvedValue(null)
      .mockRejectedValueOnce(new Error("Ese correo ya está invitado"));
    renderInvite();
    open();
    fireEvent.change(screen.getByPlaceholderText("ana@empresa.com"), {
      target: { value: "nueva@empresa.com" },
    });

    fireEvent.click(screen.getByText("Enviar invitación"));

    await waitFor(() =>
      expect(h.toasts.error).toEqual(["Ese correo ya está invitado"]),
    );
    // El diálogo se queda abierto para poder corregir el dato.
    expect(screen.getByText(/Registra el acceso por correo/)).toBeTruthy();
  });
});

describe("EditUserDialog", () => {
  function renderEdit(
    overrides: Partial<Parameters<typeof EditUserDialog>[0]> = {},
  ) {
    return render(
      <EditUserDialog target={user()} centers={CENTERS} isSelf={false} {...overrides} />,
    );
  }

  function open() {
    fireEvent.click(screen.getByText("Gestionar"));
  }

  test("abre con los datos guardados del usuario", () => {
    renderEdit();
    open();

    expect(screen.getByDisplayValue("Ana García")).toBeTruthy();
    expect(
      document.querySelector('[data-slot="dialog-description"]')?.textContent,
    ).toBe("Modifica los datos, el rol y los centros de trabajo asignados.");
    // El centro que ya tenía viene marcado.
    expect(screen.getAllByRole("checkbox")[0].getAttribute("data-state")).toBe(
      "checked",
    );
  });

  test("en tu propia cuenta el rol está bloqueado y lo explica", () => {
    renderEdit({ isSelf: true });
    open();

    expect(
      document.querySelector('[data-slot="dialog-description"]')?.textContent,
    ).toMatch(/No puedes quitarte el rol de administrador/);
    expect(
      (screen.getByRole("combobox") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test("guarda el nombre, el rol y los centros en dos mutaciones", async () => {
    renderEdit();
    open();
    fireEvent.change(screen.getByDisplayValue("Ana García"), {
      target: { value: "  Ana G.  " },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);

    fireEvent.click(screen.getByText("Guardar cambios"));

    await waitFor(() =>
      expect(h.mutations["access:updateUser"]).toHaveBeenCalledWith({
        userId: "u1",
        name: "Ana G.",
        role: "user",
      }),
    );
    expect(h.mutations["access:setUserCenters"]).toHaveBeenCalledWith({
      userId: "u1",
      centerIds: ["c2"],
    });
    expect(h.toasts.success).toEqual(["Usuario actualizado."]);
  });

  test("un rol que no es de administrador se gestiona como usuario", async () => {
    renderEdit({ target: user({ role: "member" }) });
    open();

    fireEvent.click(screen.getByText("Guardar cambios"));

    await waitFor(() =>
      expect(h.mutations["access:updateUser"]).toHaveBeenCalledWith(
        expect.objectContaining({ role: "user" }),
      ),
    );
  });

  test("si falla el rol no intenta guardar los centros", async () => {
    h.mutations["access:updateUser"] = vi
      .fn()
      .mockResolvedValue(null)
      .mockRejectedValueOnce(new Error("No se puede cambiar el rol del último admin"));
    renderEdit();
    open();

    fireEvent.click(screen.getByText("Guardar cambios"));

    await waitFor(() =>
      expect(h.toasts.error).toEqual([
        "No se puede cambiar el rol del último admin",
      ]),
    );
    expect(h.mutations["access:setUserCenters"]).not.toHaveBeenCalled();
    expect(h.toasts.success).toEqual([]);
  });

  test("al reabrir vuelve a los valores guardados, sin el borrador", () => {
    renderEdit();
    open();
    fireEvent.change(screen.getByDisplayValue("Ana García"), {
      target: { value: "Cambio sin guardar" },
    });
    fireEvent.click(screen.getByText("Cancelar"));

    open();

    expect(screen.getByDisplayValue("Ana García")).toBeTruthy();
    expect(screen.queryByDisplayValue("Cambio sin guardar")).toBeNull();
  });
});
