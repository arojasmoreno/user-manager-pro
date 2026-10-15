import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
import { UserRoundPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CenterDoc = Doc<"workCenters">;

export function InviteDialog({ centers }: { centers: CenterDoc[] }) {
  const invite = useMutation(api.access.inviteUser);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [centerIds, setCenterIds] = useState<Id<"workCenters">[]>([]);
  const [busy, setBusy] = useState(false);

  const toggleCenter = (id: Id<"workCenters">) => {
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
        name: name.trim() || undefined,
        role,
        centerIds: centerIds,
      });
      toast.success(
        role === "admin"
          ? "Invitación creada: entrará como administrador."
          : "Invitación creada. Podrá entrar con su correo cuando quiera.",
      );
      setName("");
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
            Registra el acceso por correo con nombre, rol y centros. Al
            verificar su código, la cuenta se crea ya con estos permisos.
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
              placeholder="Ana García"
            />
          </div>
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Correo electrónico
            </Label>
            <Input
              className="rounded-sm"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana@empresa.com"
            />
          </div>
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Rol
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
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
