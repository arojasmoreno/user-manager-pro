import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { CenterPicker } from "@/components/fichas/CenterPicker";
import { DocumentSource } from "@/components/fichas/DocumentSource";
import { FichaTranslations } from "@/components/FichaTranslations";
import { fichaTypeLabel, type FichaType } from "@/lib/fichaTypes";
import { TRANSLATIONS_ENABLED } from "@/lib/features";
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
import { useState } from "react";
import { toast } from "sonner";

type CenterDoc = Doc<"workCenters">;
type FichaDoc = Doc<"fichas">;

export function EditFichaDialog({
  ficha,
  centers,
  types,
}: {
  ficha: FichaDoc;
  centers: CenterDoc[];
  types: readonly FichaType[];
}) {
  const update = useMutation(api.fichas.update);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(ficha.title);
  const [kind, setKind] = useState<string>(ficha.kind);
  const [productName, setProductName] = useState(ficha.productName ?? "");
  const [manufacturer, setManufacturer] = useState(ficha.manufacturer ?? "");
  const [url, setUrl] = useState(ficha.url);
  const [centerIds, setCenterIds] = useState<Id<"workCenters">[]>(
    ficha.workCenterIds,
  );
  const [busy, setBusy] = useState(false);

  // Seed the form from the ficha when the dialog opens, so the fields always
  // reflect the latest saved values without an effect.
  const openWithFreshValues = () => {
    setTitle(ficha.title);
    setKind(ficha.kind);
    setProductName(ficha.productName ?? "");
    setManufacturer(ficha.manufacturer ?? "");
    setUrl(ficha.url);
    setCenterIds(ficha.workCenterIds);
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
      await update({
        fichaId: ficha._id,
        title: title.trim(),
        kind,
        productName: productName.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        url: url.trim(),
        workCenterIds: centerIds,
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
          onClick={openWithFreshValues}
          className="font-ui h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Editar ficha
          </DialogTitle>
          <DialogDescription>
            {fichaTypeLabel(ficha.kind, types)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto py-2 pr-1">
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Título
            </Label>
            <Input
              className="rounded-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Tipo de ficha
            </Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="rounded-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-sm bg-card">
                {/* El tipo actual siempre está en la lista, incluso si el
                    administrador acaba de retirarlo. */}
                {types.every((type) => type.slug !== kind) && (
                  <SelectItem value={kind}>{kind}</SelectItem>
                )}
                {types.map((type) => (
                  <SelectItem key={type.slug} value={type.slug}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              />
            </div>
          </div>
          <DocumentSource url={url} onUrlChange={setUrl} />
          <div className="grid gap-2">
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Centros de trabajo
            </Label>
            <CenterPicker
              centers={centers}
              selected={centerIds}
              onToggle={toggleCenter}
            />
          </div>

          {/* Se pide las traducciones sólo con el diálogo abierto y sólo si la
              función está activa (ver `features.ts`). */}
          {TRANSLATIONS_ENABLED && (
            <FichaTranslations fichaId={ficha._id} enabled={open} />
          )}
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
