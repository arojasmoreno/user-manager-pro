import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import {
  ExternalLink,
  FileText,
  FlaskConical,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CenterDoc = Doc<"workCenters">;

const KIND_LABELS = {
  ficha_tecnica: "Ficha técnica",
  ficha_seguridad: "Ficha de seguridad",
} as const;

function CreateFichaDialog({ centers }: { centers: CenterDoc[] }) {
  const create = useMutation(api.fichas.create);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"ficha_tecnica" | "ficha_seguridad">(
    "ficha_tecnica",
  );
  const [productName, setProductName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [url, setUrl] = useState("");
  const [centerIds, setCenterIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggleCenter = (id: string) => {
    setCenterIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const reset = () => {
    setTitle("");
    setKind("ficha_tecnica");
    setProductName("");
    setManufacturer("");
    setUrl("");
    setCenterIds([]);
  };

  const submit = async () => {
    if (!title.trim() || !productName.trim() || !url.trim() || centerIds.length === 0) {
      toast.error("Completa título, producto, URL y al menos un centro.");
      return;
    }
    setBusy(true);
    try {
      await create({
        title: title.trim(),
        kind,
        productName: productName.trim(),
        manufacturer: manufacturer.trim() || undefined,
        url: url.trim(),
        workCenterIds: centerIds as any,
      });
      toast.success("Ficha creada y asignada.");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear la ficha.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-ui gap-2 rounded-sm">
          <Plus className="size-4" />
          Nueva ficha
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Nueva ficha</DialogTitle>
          <DialogDescription>
            Añade una ficha técnica o de seguridad y asígnala a los centros
            donde se utiliza el producto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Tipo
            </Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as typeof kind)}
            >
              <SelectTrigger className="rounded-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-sm bg-card">
                <SelectItem value="ficha_tecnica">Ficha técnica</SelectItem>
                <SelectItem value="ficha_seguridad">
                  Ficha de seguridad
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Título
            </Label>
            <Input
              className="rounded-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Disolvente industrial — v1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
                Producto
              </Label>
              <Input
                className="rounded-sm"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Nombre del producto químico"
              />
            </div>
            <div className="grid gap-2">
              <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
                Fabricante
              </Label>
              <Input
                className="rounded-sm"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              URL del documento
            </Label>
            <Input
              className="rounded-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              type="url"
            />
          </div>

          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Centros de trabajo
            </Label>
            {centers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Crea primero un centro de trabajo en la pestaña «Centros».
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {centers.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => toggleCenter(c._id)}
                    className={cn(
                      "font-ui rounded-sm border px-3 py-1.5 text-xs transition-colors",
                      centerIds.includes(c._id)
                        ? "border-foreground bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/40",
                    )}
                  >
                    {c.name}
                  </button>
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
          <Button
            className="font-ui rounded-sm"
            onClick={submit}
            disabled={busy || centers.length === 0}
          >
            Crear ficha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditFichaDialog({
  ficha,
  centers,
}: {
  ficha: Doc<"fichas">;
  centers: CenterDoc[];
}) {
  const update = useMutation(api.fichas.update);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(ficha.url);
  const [centerIds, setCenterIds] = useState<string[]>(ficha.workCenterIds);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(ficha.url);
      setCenterIds(ficha.workCenterIds);
    }
  }, [open, ficha]);

  const toggleCenter = (id: string) => {
    setCenterIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    setBusy(true);
    try {
      await update({
        fichaId: ficha._id,
        url: url.trim(),
        workCenterIds: centerIds as any,
      });
      toast.success("Ficha actualizada.");
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar la ficha.",
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
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Editar ficha
          </DialogTitle>
          <DialogDescription>{ficha.title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              URL del documento
            </Label>
            <Input
              className="rounded-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
            />
          </div>
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Centros de trabajo
            </Label>
            <div className="flex flex-wrap gap-2">
              {centers.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => toggleCenter(c._id)}
                  className={cn(
                    "font-ui rounded-sm border px-3 py-1.5 text-xs transition-colors",
                    centerIds.includes(c._id)
                      ? "border-foreground bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  {c.name}
                </button>
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
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteFichaButton({ fichaId }: { fichaId: string }) {
  const remove = useMutation(api.fichas.remove);
  const [busy, setBusy] = useState(false);

  const confirmAndDelete = async () => {
    if (!window.confirm("¿Eliminar esta ficha definitivamente?")) return;
    setBusy(true);
    try {
      await remove({ fichaId: fichaId as any });
      toast.success("Ficha eliminada.");
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
      className="font-ui h-8 px-2 text-xs text-destructive hover:text-destructive"
      onClick={confirmAndDelete}
      disabled={busy}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

export function FichasSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  const fichas = useQuery(api.fichas.listMine, {});
  const adminFichas = useQuery(api.fichas.listAll, isAdmin ? {} : "skip");
  const adminCenters = useQuery(api.access.listCenters, isAdmin ? {} : "skip");
  const myCentersData = useQuery(api.access.listMyCenters, isAdmin ? "skip" : {});
  const myCenters = isAdmin ? (adminCenters ?? []) : (myCentersData ?? []);

  const list = isAdmin ? (adminFichas ?? fichas) : fichas;
  const [filter, setFilter] = useState<"all" | "ficha_tecnica" | "ficha_seguridad">(
    "all",
  );

  const centerNames = (ids: string[]) => {
    if (!myCenters) return [];
    return ids
      .map((id) => myCenters.find((c) => c._id === id)?.name)
      .filter(Boolean) as string[];
  };

  const filtered = (list ?? []).filter((f) =>
    filter === "all" ? true : f.kind === filter,
  );

  const tecnicas = (list ?? []).filter((f) => f.kind === "ficha_tecnica").length;
  const seguridad = (list ?? []).filter((f) => f.kind === "ficha_seguridad").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">Documentación</p>
          <h2 className="font-display mt-2 text-3xl font-semibold">Fichas</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            {isAdmin
              ? "Gestiona fichas técnicas y de seguridad y asígnalas a los centros de trabajo."
              : "Fichas técnicas y de seguridad de los productos químicos de tu centro."}
          </p>
        </div>
        {isAdmin && <CreateFichaDialog centers={myCenters} />}
      </div>

      {/* Filter rail */}
      <div className="flex items-center gap-4 border-y border-border py-3">
        {(
          [
            ["all", "Todas"],
            ["ficha_tecnica", "Técnicas"],
            ["ficha_seguridad", "Seguridad"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "font-ui text-sm transition-colors",
              filter === value
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <span className="font-ui ml-auto text-xs text-muted-foreground">
          {tecnicas} técnicas · {seguridad} de seguridad
        </span>
      </div>

      {!list ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border bg-card/50 p-14 text-center">
          <FlaskConical className="mx-auto size-8 text-muted-foreground/60" />
          <p className="font-display mt-4 text-lg">
            Todavía no hay fichas aquí
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {isAdmin
              ? "Crea la primera ficha y asígnala a un centro de trabajo."
              : "Cuando tu administrador añada fichas a tu centro, aparecerán aquí."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <article
              key={f._id}
              className={cn(
                "group flex flex-col rounded-sm border bg-card p-6 transition-shadow hover:shadow-[0_1px_0_0_var(--border),0_8px_24px_-16px_rgba(0,0,0,0.25)]",
                !f.active && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-sm border",
                    f.kind === "ficha_seguridad"
                      ? "border-destructive/30 text-destructive"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {f.kind === "ficha_seguridad" ? (
                    <ShieldAlert className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className="font-ui rounded-sm text-[10px] uppercase tracking-wider"
                >
                  {KIND_LABELS[f.kind]}
                </Badge>
              </div>

              <h3 className="font-display mt-4 text-lg leading-snug font-semibold">
                {f.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {f.productName}
                {f.manufacturer ? ` · ${f.manufacturer}` : ""}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {centerNames(f.workCenterIds).map((name) => (
                  <span
                    key={name}
                    className="font-ui rounded-sm border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {name}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-ui inline-flex items-center gap-1.5 text-xs font-medium underline-offset-4 hover:underline"
                >
                  Abrir documento
                  <ExternalLink className="size-3" />
                </a>
                {isAdmin && (
                  <div className="ml-auto flex items-center gap-1">
                    <EditFichaDialog ficha={f} centers={myCenters} />
                    <DeleteFichaButton fichaId={f._id} />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
