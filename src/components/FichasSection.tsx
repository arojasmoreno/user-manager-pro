import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/roles";
import { isSupabaseConfigured, supabase, FICHAS_BUCKET } from "@/lib/supabase";
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
  BookOpen,
  ExternalLink,
  FileText,
  ListChecks,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CenterDoc = Doc<"workCenters">;
type FichaDoc = Doc<"fichas">;
type FichaKind = FichaDoc["kind"];

const KIND_LABELS: Record<FichaKind, string> = {
  ficha_tecnica: "Ficha técnica",
  ficha_seguridad: "Ficha de seguridad",
  manual_instrucciones: "Manual de instrucciones",
  instrucciones_trabajo: "Instrucciones de trabajo",
};

const KIND_ICONS: Record<FichaKind, typeof FileText> = {
  ficha_tecnica: FileText,
  ficha_seguridad: ShieldAlert,
  manual_instrucciones: BookOpen,
  instrucciones_trabajo: ListChecks,
};

/** Shared source-of-document control: upload to Supabase or paste a URL. */
function DocumentSource({
  url,
  onUrlChange,
}: {
  url: string;
  onUrlChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!supabase) {
      toast.error(
        "La subida de archivos necesita las claves de Supabase. Añádelas en la pestaña Keys o pega una URL.",
      );
      return;
    }
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await supabase.storage
        .from(FICHAS_BUCKET)
        .upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from(FICHAS_BUCKET).getPublicUrl(path);
      onUrlChange(data.publicUrl);
      toast.success("Documento subido. Recuerda guardar la ficha.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `No se pudo subir: ${err.message}`
          : "No se pudo subir el archivo.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
        Documento
      </Label>
      <div className="flex gap-2">
        <Input
          className="rounded-sm"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://… o sube un PDF"
          type="url"
        />
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="font-ui shrink-0 rounded-sm"
          disabled={uploading || !isSupabaseConfigured}
          title={
            isSupabaseConfigured
              ? "Subir archivo"
              : "Configura Supabase en la pestaña Keys para subir archivos"
          }
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
        </Button>
      </div>
      <p className="font-ui text-[11px] leading-relaxed text-muted-foreground">
        {isSupabaseConfigured
          ? "Pega un enlace o sube el documento; se guardará en el almacenamiento del proyecto."
          : "Subida de archivos disponible al añadir las claves de Supabase. Puedes pegar una URL mientras tanto."}
      </p>
    </div>
  );
}

/** Center multi-select chips shared by create/edit dialogs. */
function CenterPicker({
  centers,
  selected,
  onToggle,
}: {
  centers: CenterDoc[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (centers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Crea primero un centro de trabajo en la pestaña «Centros».
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {centers.map((c) => (
        <button
          key={c._id}
          type="button"
          onClick={() => onToggle(c._id)}
          className={cn(
            "font-ui rounded-sm border px-3 py-1.5 text-xs transition-colors",
            selected.includes(c._id)
              ? "border-foreground bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-foreground/40",
          )}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

function CreateFichaDialog({ centers }: { centers: CenterDoc[] }) {
  const create = useMutation(api.fichas.create);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<FichaKind>("ficha_tecnica");
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
      toast.error(
        "Completa título, producto, documento y al menos un centro de trabajo.",
      );
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
              Tipo de documento
            </Label>
            <Select value={kind} onValueChange={(v) => setKind(v as FichaKind)}>
              <SelectTrigger className="rounded-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-sm bg-card">
                <SelectItem value="ficha_tecnica">Ficha técnica</SelectItem>
                <SelectItem value="ficha_seguridad">Ficha de seguridad</SelectItem>
                <SelectItem value="manual_instrucciones">
                  Manual de instrucciones
                </SelectItem>
                <SelectItem value="instrucciones_trabajo">
                  Instrucciones de trabajo
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
              placeholder="Disolvente industrial — revisión 2"
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
                placeholder="Nombre del producto"
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
            Añadir ficha
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
  ficha: FichaDoc;
  centers: CenterDoc[];
}) {
  const update = useMutation(api.fichas.update);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(ficha.title);
  const [productName, setProductName] = useState(ficha.productName);
  const [manufacturer, setManufacturer] = useState(ficha.manufacturer ?? "");
  const [url, setUrl] = useState(ficha.url);
  const [centerIds, setCenterIds] = useState<string[]>(ficha.workCenterIds);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(ficha.title);
      setProductName(ficha.productName);
      setManufacturer(ficha.manufacturer ?? "");
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
        title: title.trim(),
        productName: productName.trim(),
        manufacturer: manufacturer.trim() || undefined,
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
          <DialogDescription>{KIND_LABELS[ficha.kind]}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-4 overflow-y-auto py-2 pr-1">
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
    if (!window.confirm("¿Eliminar esta ficha del catálogo?")) return;
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

  const [filter, setFilter] = useState<"all" | FichaKind>("all");
  const [search, setSearch] = useState("");

  const centerNames = (ids: string[]) =>
    ids
      .map((id) => myCenters.find((c) => c._id === id)?.name)
      .filter(Boolean) as string[];

  const filtered = (list ?? []).filter((f) => {
    if (filter !== "all" && f.kind !== filter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      f.productName.toLowerCase().includes(q) ||
      (f.manufacturer ?? "").toLowerCase().includes(q)
    );
  });

  const counts = {
    ficha_tecnica: (list ?? []).filter((f) => f.kind === "ficha_tecnica").length,
    ficha_seguridad: (list ?? []).filter((f) => f.kind === "ficha_seguridad")
      .length,
    manual_instrucciones: (list ?? []).filter(
      (f) => f.kind === "manual_instrucciones",
    ).length,
    instrucciones_trabajo: (list ?? []).filter(
      (f) => f.kind === "instrucciones_trabajo",
    ).length,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">Catálogo documental</p>
          <h2 className="font-display mt-2 text-3xl font-semibold">Fichas</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            {isAdmin
              ? "Añade, modifica y elimina fichas del catálogo y asígnalas a los centros de trabajo."
              : "Fichas técnicas, de seguridad, manuales e instrucciones de tu centro de trabajo."}
          </p>
        </div>
        {isAdmin && <CreateFichaDialog centers={myCenters} />}
      </div>

      {/* Search + filter rail */}
      <div className="flex flex-col gap-4 border-y border-border py-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 rounded-sm pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, producto o fabricante…"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {(
            [
              ["all", "Todas"],
              ["ficha_tecnica", "Técnicas"],
              ["ficha_seguridad", "Seguridad"],
              ["manual_instrucciones", "Manuales"],
              ["instrucciones_trabajo", "Instrucciones"],
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
              {value !== "all" && (
                <span className="ml-1 text-xs text-muted-foreground/70">
                  {counts[value]}
                </span>
            )}
            </button>
          ))}
        </div>
      </div>

      {!list ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border bg-card/50 p-14 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground/60" />
          <p className="font-display mt-4 text-lg">
            {search || filter !== "all"
              ? "Sin resultados"
              : "Todavía no hay fichas aquí"}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {search || filter !== "all"
              ? "Prueba con otro término de búsqueda o cambia el filtro."
              : isAdmin
                ? "Añade la primera ficha y asígnala a un centro de trabajo."
                : "Cuando tu administrador añada fichas a tu centro, aparecerán aquí."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => {
            const Icon = KIND_ICONS[f.kind];
            return (
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
                    <Icon className="size-4" />
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
            );
          })}
        </div>
      )}
    </div>
  );
}
