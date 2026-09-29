import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
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
import { useMutation, useQuery } from "convex/react";
import { Building2, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function CreateCenterDialog() {
  const create = useMutation(api.access.createCenter);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !code.trim() || !address.trim()) {
      toast.error("Completa nombre, código y dirección.");
      return;
    }
    setBusy(true);
    try {
      await create({
        name: name.trim(),
        code: code.trim(),
        address: address.trim(),
      });
      toast.success("Centro creado.");
      setName("");
      setCode("");
      setAddress("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear el centro.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-ui gap-2 rounded-sm">
          <Plus className="size-4" />
          Nuevo centro
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Nuevo centro de trabajo
          </DialogTitle>
          <DialogDescription>
            Los centros son el eje del archivo: cada ficha y cada usuario se
            asigna a uno o varios.
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
              placeholder="Fábrica Norte"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
                Código
              </Label>
              <Input
                className="rounded-sm"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="FAN-01"
              />
            </div>
            <div className="grid gap-2">
              <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
                Dirección
              </Label>
              <Input
                className="rounded-sm"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle Mayor 1"
              />
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
            Crear centro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCenterButton({ centerId }: { centerId: string }) {
  const remove = useMutation(api.access.deleteCenter);
  const [busy, setBusy] = useState(false);

  const confirmAndDelete = async () => {
    if (
      !window.confirm(
        "¿Eliminar este centro? Los usuarios y fichas asignadas dejarán de apuntar a él.",
      )
    )
      return;
    setBusy(true);
    try {
      await remove({ centerId: centerId as any });
      toast.success("Centro eliminado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="font-ui h-8 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
      onClick={confirmAndDelete}
      disabled={busy}
    >
      <Trash2 className="size-3.5" />
      Eliminar
    </Button>
  );
}

export function CentrosSection() {
  const centers = useQuery(api.access.listCenters, {});
  const users = useQuery(api.access.listUsers, {});
  const fichas = useQuery(api.fichas.listAll, {});

  const userCount = (centerId: string) =>
    (users ?? []).filter((u) => (u.workCenterIds ?? []).includes(centerId as any))
      .length;

  const fichaCount = (center: Doc<"workCenters">) =>
    (fichas ?? []).filter((f) => (f.workCenterIds ?? []).includes(center._id))
      .length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">Organización</p>
          <h2 className="font-display mt-2 text-3xl font-semibold">Centros</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Centros de trabajo de la organización. Cada ficha se asigna a uno o
            varios centros.
          </p>
        </div>
        <CreateCenterDialog />
      </div>

      {!centers ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-sm bg-muted" />
          ))}
        </div>
      ) : centers.length === 0 ? (
        <div className="border border-dashed border-border bg-card/50 p-14 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground/60" />
          <p className="font-display mt-4 text-lg">Aún no hay centros</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Crea el primer centro de trabajo para empezar a organizar usuarios y
            fichas.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border">
          {centers.map((c, idx) => (
            <div
              key={c._id}
              className={
                "flex flex-col gap-3 bg-card p-5 sm:flex-row sm:items-center sm:justify-between " +
                (idx > 0 ? "border-t border-border" : "")
              }
            >
              <div className="flex items-start gap-4">
                <div className="flex size-9 items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold">{c.name}</h3>
                    <span className="font-ui rounded-sm border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.code}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.address}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <span className="font-ui flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {userCount(c._id)} usuarios
                </span>
                <span className="font-ui text-xs text-muted-foreground">
                  {fichaCount(c)} fichas
                </span>
                <DeleteCenterButton centerId={c._id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
