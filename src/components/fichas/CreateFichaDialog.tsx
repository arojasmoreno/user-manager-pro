import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { CenterPicker } from "@/components/fichas/CenterPicker";
import { DocumentSource } from "@/components/fichas/DocumentSource";
import type { FichaType } from "@/lib/fichaTypes";
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
import { useMutation } from "convex/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CenterDoc = Doc<"workCenters">;

export function CreateFichaDialog({
  centers,
  types,
}: {
  centers: CenterDoc[];
  types: readonly FichaType[];
}) {
  const create = useMutation(api.fichas.create);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>(types[0]?.slug ?? "");
  const [productName, setProductName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [url, setUrl] = useState("");
  const [centerIds, setCenterIds] = useState<Id<"workCenters">[]>([]);
  const [busy, setBusy] = useState(false);

  const toggleCenter = (id: Id<"workCenters">) => {
    setCenterIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const reset = () => {
    setTitle("");
    setKind(types[0]?.slug ?? "");
    setProductName("");
    setManufacturer("");
    setUrl("");
    setCenterIds([]);
  };

  const submit = async () => {
    if (!title.trim() || !url.trim() || centerIds.length === 0 || !kind) {
      toast.error(
        "Completa el tipo, el nombre, el documento y al menos un centro de trabajo.",
      );
      return;
    }
    setBusy(true);
    try {
      await create({
        title: title.trim(),
        kind,
        productName: productName.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        url: url.trim(),
        workCenterIds: centerIds,
      });
      toast.success("Ficha añadida al catálogo.");
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
          Añadir ficha
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Nueva ficha</DialogTitle>
          <DialogDescription>
            Añade un documento al catálogo y asígnalo a los centros donde se
            utiliza.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto py-2 pr-1">
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Nombre de la ficha
            </Label>
            <Input
              className="rounded-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Disolvente industrial — revisión 2"
            />
          </div>

          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Tipo de ficha
            </Label>
            {types.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay ningún tipo de ficha activo. Créalo en «Tipos de ficha»
                antes de añadir documentos.
              </p>
            ) : (
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-sm bg-card">
                  {types.map((type) => (
                    <SelectItem key={type.slug} value={type.slug}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Centro al que pertenece
            </Label>
            <CenterPicker
              centers={centers}
              selected={centerIds}
              onToggle={toggleCenter}
            />
            <p className="font-ui text-[11px] leading-relaxed text-muted-foreground">
              Cada persona verá esta ficha si su centro está marcado aquí.
            </p>
          </div>

          <DocumentSource url={url} onUrlChange={setUrl} />

          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
                Producto o equipo (opcional)
              </Label>
              <Input
                className="rounded-sm"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Tornillo de bancada 400 V"
              />
            </div>
            <div className="grid gap-2">
              <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
                Fabricante (opcional)
              </Label>
              <Input
                className="rounded-sm"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Nombre del fabricante"
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
          <Button
            className="font-ui rounded-sm"
            onClick={submit}
            disabled={busy || centers.length === 0 || types.length === 0}
          >
            Añadir ficha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
