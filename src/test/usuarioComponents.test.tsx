import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Subcomponentes de la pestaña Usuarios. Las mutaciones se identifican por su
 * referencia (`access:setUserBlocked`, `access:deleteUser`…) y no por orden de
 * llamada, así que da igual cuántos botones monte la fila.
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

import { BlockButton } from "@/components/usuarios/BlockButton";
import { DeleteUserButton } from "@/components/usuarios/DeleteUserButton";
import { PendingInvites } from "@/components/usuarios/PendingInvites";
import { UserRowItem } from "@/components/usuarios/UserRowItem";
import type { UserRow } from "@/components/usuarios/EditUserDialog";

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

/**
 * Fila de usuario para los tests. Los centros se piden como cadenas legibles
 * («c1») y la conversión a los identificadores de Convex se hace aquí, en un
 * único sitio, en lugar de en cada test.
 */
function user(
  overrides: Partial<Omit<UserRow, "workCenterIds">> & { workCenterIds?: string[] } = {},
): UserRow {
  return {
    _id: "u1",
    _creationTime: 5,
    email: "ana@example.com",
    name: "Ana García",
    role: "user",
    workCenterIds: [],
    ...overrides,
  } as unknown as UserRow;
}

beforeEach(() => {
  h.mutations = {};
  h.toasts.success = [];
  h.toasts.error = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BlockButton", () => {
  test("bloquea la cuenta y lo confirma", async () => {
    render(<BlockButton target={user()} isSelf={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Bloquear/ }));

    await waitFor(() =>
      expect(h.mutations["access:setUserBlocked"]).toHaveBeenCalledWith({
        userId: "u1",
        blocked: true,
      }),
    );
    expect(h.toasts.success).toEqual(["Usuario bloqueado."]);
  });

  test("si ya estaba bloqueada, desbloquea", async () => {
    render(<BlockButton target={user({ blocked: true })} isSelf={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Desbloquear/ }));

    await waitFor(() =>
      expect(h.mutations["access:setUserBlocked"]).toHaveBeenCalledWith({
        userId: "u1",
        blocked: false,
      }),
    );
    expect(h.toasts.success).toEqual(["Usuario desbloqueado."]);
  });

  test("nadie puede bloquear su propia cuenta", () => {
    render(<BlockButton target={user()} isSelf />);

    const boton = screen.getByRole("button", { name: /Bloquear/ }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    expect(boton.getAttribute("title")).toMatch(/tu propia cuenta/);

    fireEvent.click(boton);
    expect(h.mutations["access:setUserBlocked"]).not.toHaveBeenCalled();
  });

  test("enseña el error del servidor", async () => {
    h.mutations["access:setUserBlocked"] = vi
      .fn()
      .mockResolvedValue(null)
      .mockRejectedValueOnce(new Error("No puedes bloquear al administrador"));
    render(<BlockButton target={user()} isSelf={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Bloquear/ }));

    await waitFor(() =>
      expect(h.toasts.error).toEqual([
        "No puedes bloquear al administrador",
      ]),
    );
  });
});

describe("DeleteUserButton", () => {
  test("pregunta por la cuenta concreta antes de borrar", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<DeleteUserButton target={user()} />);

    fireEvent.click(screen.getByRole("button"));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("Ana García"),
    );
    expect(h.mutations["access:deleteUser"]).not.toHaveBeenCalled();
  });

  test("borra la cuenta tras confirmar", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DeleteUserButton target={user()} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(h.mutations["access:deleteUser"]).toHaveBeenCalledWith({
        userId: "u1",
      }),
    );
    expect(h.toasts.success).toEqual(["Cuenta eliminada."]);
  });

  test("sin nombre usa el correo en la confirmación, y avisa del error", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    h.mutations["access:deleteUser"] = vi
      .fn()
      .mockResolvedValue(null)
      .mockRejectedValueOnce(new Error("Es el último administrador"));
    render(<DeleteUserButton target={user({ name: undefined })} />);

    fireEvent.click(screen.getByRole("button"));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("ana@example.com"),
    );
    await waitFor(() =>
      expect(h.toasts.error).toEqual(["Es el último administrador"]),
    );
  });
});

describe("PendingInvites", () => {
  const INVITES = [
    { _id: "i1", email: "nuevo@example.com", role: "user" },
    { _id: "i2", email: "jefa@example.com", role: "admin" },
  ] as unknown as Parameters<typeof PendingInvites>[0]["invites"];

  test("sin invitaciones no pinta nada", () => {
    const { container } = render(
      <PendingInvites invites={[]} onRevoke={vi.fn()} />,
    );

    expect(container.innerHTML).toBe("");
  });

  test("lista cada invitación con su rol y el total", () => {
    render(<PendingInvites invites={INVITES} onRevoke={vi.fn()} />);

    expect(screen.getByText("Invitaciones pendientes")).toBeTruthy();
    expect(screen.getByText("(2)")).toBeTruthy();
    expect(screen.getByText("nuevo")).toBeTruthy();
    expect(screen.getByText("Usuario")).toBeTruthy();
    expect(screen.getByText("jefa")).toBeTruthy();
    expect(screen.getByText("Administrador")).toBeTruthy();
  });

  test("revocar devuelve el identificador de esa invitación", () => {
    const onRevoke = vi.fn();
    render(<PendingInvites invites={INVITES} onRevoke={onRevoke} />);

    const botones = screen.getAllByRole("button", { name: "Revocar" });
    fireEvent.click(botones[1]);

    expect(onRevoke).toHaveBeenCalledWith("i2");
  });
});

describe("UserRowItem", () => {
  function renderRow(
    overrides: Partial<Parameters<typeof UserRowItem>[0]> = {},
  ) {
    return render(
      <UserRowItem
        user={user()}
        meId={"u9" as never}
        centers={CENTERS}
        first
        {...overrides}
      />,
    );
  }

  test("muestra el nombre, el correo y los centros asignados", () => {
    renderRow({ user: user({ workCenterIds: ["c1", "c2"] }) });

    expect(screen.getByText("Ana García")).toBeTruthy();
    expect(
      screen.getByText("ana@example.com · MDLZ Montornes, Granollers"),
    ).toBeTruthy();
    expect(screen.getByText("Usuario")).toBeTruthy();
  });

  test("un centro borrado no deja el correo con un separador suelto", () => {
    renderRow({ user: user({ workCenterIds: ["c-borrado"] }) });

    expect(screen.getByText("ana@example.com")).toBeTruthy();
  });

  test("sin nombre ni correo no deja la fila vacía", () => {
    renderRow({ user: user({ name: undefined, email: undefined }) });

    expect(screen.getByText("Sin nombre")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });

  test("el administrador se distingue por su insignia", () => {
    renderRow({ user: user({ role: "admin" }) });

    expect(screen.getByText("Administrador")).toBeTruthy();
  });

  test("una cuenta bloqueada se marca y se tacha", () => {
    renderRow({ user: user({ blocked: true }) });

    expect(screen.getByText("Bloqueado")).toBeTruthy();
    expect(screen.getByText("Ana García").className).toContain("line-through");
  });

  test("en tu propia fila no hay botón de borrar", () => {
    const { unmount } = renderRow({ meId: "u1" as never });
    expect(screen.getByText("(tú)")).toBeTruthy();
    // Gestionar + Bloquear; el borrado no se ofrece a uno mismo.
    expect(screen.getAllByRole("button")).toHaveLength(2);
    unmount();

    renderRow({ meId: "u9" as never });
    expect(screen.queryByText("(tú)")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
