import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery } from "convex/react";
import {
  Mail,
  MailCheck,
  MailX,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type UserRow = Doc<"users"> & { workCenterIds?: string[] };
type CenterDoc = Doc<"workCenters">;

// ---------------------------------------------------------------------------
// Invite dialog
// ---------------------------------------------------------------------------

function InviteDialog({ centers }: { centers: CenterDoc[] }) {
  const invite = useMutation(api.access.inviteUser);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [centerIds, setCenterIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggleCenter = (id: string) => {
    setCenterIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    if (!email.trim() || !email.includes("@")) {
      toast.error("Introduce un correo válido.");
      return;
    }
    setBusy(true);
    try {
      await invite({
        email: email.trim().toLowerCase(),
        role,
        centerIds: centerIds as any,
      });
      toast.success(
        role === "admin"
          ? "Invitación creada: será administrador al entrar."
          : "Invitación creada. Podrá entrar con su correo cuando quiera.",
      );
      setEmail("");
      setRole("user");
      setCenterIds([]);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al invitar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-ui gap-2 rounded-sm">
          <UserRoundPlus className="size-4" />
          Añadir usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Añadir usuario
          </DialogTitle>
          <DialogDescription>
            Registra el acceso por correo. Al verificar su código, la persona
            entrará ya con este rol y estos centros.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Correo electrónico
            </Label>
            <Input
              className="rounded-sm"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@empresa.com"
            />
          </div>
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Rol
            </Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as typeof role)}
            >
              <SelectTrigger className="rounded-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-sm bg-card">
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Centros de trabajo
            </Label>
            {centers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay centros. Créalos en la pestaña «Centros».
              </p>
            ) : (
              <div className="space-y-2">
                {centers.map((c) => (
                  <label
                    key={c._id}
                    className="flex cursor-pointer items-center gap-2.5 text-sm"
                  >
                    <Checkbox
                      checked={centerIds.includes(c._id)}
                      onCheckedChange={() => toggleCenter(c._id)}
                    />
                    {c.name}
                    <span className="font-ui text-xs text-muted-foreground">
                      {c.code}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="font-ui rounded-sm"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button className="font-ui rounded-sm" onClick={submit} disabled={busy}>
            Enviar invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit user dialog (role + centers)
// ---------------------------------------------------------------------------

function EditUserDialog({
  target,
  centers,
  isSelf,
}: {
  target: UserRow;
  centers: CenterDoc[];
  isSelf: boolean;
}) {
  const updateUser = useMutation(api.access.updateUser);
  const setUserCenters = useMutation(api.access.setUserCenters);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "user">(
    target.role === ROLES.ADMIN ? "admin" : "user",
  );
  const [centerIds, setCenterIds] = useState<string[]>(
    (target.workCenterIds ?? []) as string[],
  );
  const [busy, setBusy] = useState(false);

  const toggleCenter = (id: string) => {
    setCenterIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (role !== (target.role === ROLES.ADMIN ? "admin" : "user")) {
        await updateUser({ userId: target._id, role });
      }
      await setUserCenters({
        userId: target._id,
        centerIds: centerIds as any,
      });
      toast.success("Usuario actualizado.");
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar el usuario.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="font-ui h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Gestionar
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {target.name || target.email || "Usuario"}
          </DialogTitle>
          <DialogDescription>
            {isSelf
              ? "Esta es tu propia cuenta. No puedes quitarte el rol de administrador."
              : "Ajusta el rol y los centros de trabajo asignados."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Rol
            </Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as typeof role)}
              disabled={isSelf}
            >
              <SelectTrigger className="rounded-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-sm bg-card">
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Centros de trabajo
            </Label>
            <div className="space-y-2">
              {centers.map((c) => (
                <label
                  key={c._id}
                  className="flex cursor-pointer items-center gap-2.5 text-sm"
                >
                  <Checkbox
                    checked={centerIds.includes(c._id)}
                    onCheckedChange={() => toggleCenter(c._id)}
                  />
                  {c.name}
                  <span className="font-ui text-xs text-muted-foreground">
                    {c.code}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="font-ui rounded-sm"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button className="font-ui rounded-sm" onClick={submit} disabled={busy}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function UsuariosSection() {
  const me = useQuery(api.users.currentUser, {});
  const users = useQuery(api.access.listUsers, {});
  const centers = useQuery(api.access.listCenters, {});
  const invites = useQuery(api.access.listInvites, {});
  const revokeInvite = useMutation(api.access.revokeInvite);

  const pending = (invites ?? []).filter((i) => i.status === "pending");

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInvite({ inviteId: inviteId as any });
      toast.success("Invitación revocada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al revocar.");
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">Personas</p>
          <h2 className="font-display mt-2 text-3xl font-semibold">Usuarios</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Añade usuarios por correo, asigna roles y centros de trabajo.
          </p>
        </div>
        <InviteDialog centers={centers ?? []} />
      </div>

      {/* Pending invites */}
      {invites !== undefined && pending.length > 0 && (
        <section>
          <h3 className="font-ui flex items-center gap-2 text-sm font-medium">
            <Mail className="size-4 text-muted-foreground" />
            Invitaciones pendientes
            <span className="text-muted-foreground">({pending.length})</span>
          </h3>
          <div className="mt-3 overflow-hidden rounded-sm border border-border">
            {pending.map((inv, idx) => (
              <div
                key={inv._id}
                className={cn(
                  "flex flex-col gap-2 bg-card p-4 sm:flex-row sm:items-center sm:justify-between",
                  idx > 0 && "border-t border-border",
                )}
              >
                <div className="flex items-center gap-3">
                  {inv.status === "accepted" ? (
                    <MailCheck className="size-4 text-muted-foreground" />
                  ) : (
                    <MailX className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">{inv.email}</span>
                  <Badge
                    variant="outline"
                    className="font-ui rounded-sm text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    {inv.role === ROLES.ADMIN ? "Administrador" : "Usuario"}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-ui h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => handleRevoke(inv._id)}
                >
                  Revocar
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Users table */}
      <section>
        <h3 className="font-ui flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-muted-foreground" />
          Cuentas
          <span className="text-muted-foreground">
            ({(users ?? []).length})
          </span>
        </h3>

        {!users ? (
          <div className="mt-3 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-sm bg-muted" />
            ))}
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-sm border border-border">
            {users.map((u, idx) => {
              const isSelf = me?._id === u._id;
              const assigned = (u.workCenterIds ?? [])
                .map((id) => (centers ?? []).find((c) => c._id === id)?.name)
                .filter(Boolean) as string[];
              return (
                <div
                  key={u._id}
                  className={cn(
                    "flex flex-col gap-3 bg-card p-4 sm:flex-row sm:items-center sm:justify-between",
                    idx > 0 && "border-t border-border",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground">
                      {u.role === ROLES.ADMIN ? (
                        <ShieldCheck className="size-4" />
                      ) : (
                        <UserRound className="size-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {u.name || u.email || "Sin nombre"}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-ui rounded-sm text-[10px] uppercase tracking-wider text-muted-foreground"
                        >
                          {u.role === ROLES.ADMIN ? "Administrador" : "Usuario"}
                        </Badge>
                        {isSelf && (
                          <span className="font-ui text-[11px] text-muted-foreground">
                            (tú)
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {u.email ?? "—"}
                        {assigned.length > 0 && ` · ${assigned.join(", ")}`}
                      </p>
                    </div>
                  </div>
                  <EditUserDialog
                    target={u as UserRow}
                    centers={centers ?? []}
                    isSelf={isSelf}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
