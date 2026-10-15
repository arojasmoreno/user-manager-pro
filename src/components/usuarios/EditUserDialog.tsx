import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ROLES } from "@/lib/roles";
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
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

export type UserRow = Doc<"users"> & { blocked?: boolean };
type CenterDoc = Doc<"workCenters">;

export function EditUserDialog({
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
  const [name, setName] = useState(target.name ?? "");
  const [role, setRole] = useState<"admin" | "user">(
    target.role === ROLES.ADMIN ? "admin" : "user",
  );
  const [centerIds, setCenterIds] = useState<Id<"workCenters">[]>(
    target.workCenterIds ?? [],
  );
  const [busy, setBusy] = useState(false);

  // Seed the form from the user record when the dialog opens instead of
  // syncing it with an effect.
  const openWithFreshValues = () => {
    setName(target.name ?? "");
    setRole(target.role === ROLES.ADMIN ? "admin" : "user");
    setCenterIds(target.workCenterIds ?? []);
    setOpen(true);
  };

  const toggleCenter = (id: Id<"workCenters">) => {
    setCenterIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    setBusy(true);
    try {
      await updateUser({
        userId: target._id,
        name: name.trim() || undefined,
        role,
      });
      await setUserCenters({
        userId: target._id,
        centerIds: centerIds,
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
          onClick={openWithFreshValues}
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
              : "Modifica los datos, el rol y los centros de trabajo asignados."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Nombre
            </Label>
            <Input
              className="rounded-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
