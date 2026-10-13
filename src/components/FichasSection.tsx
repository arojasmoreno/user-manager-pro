import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ErrorState } from "@/components/ErrorState";
import { FichaTypesDialog } from "@/components/FichaTypesDialog";
import { useAuth } from "@/hooks/use-auth";
import { useSafeQuery } from "@/hooks/use-safe-query";
import { ROLES } from "@/lib/roles";
import { isSupabaseConfigured, supabase, FICHAS_BUCKET } from "@/lib/supabase";
import {
  DEFAULT_FICHA_ICON,
  fichaTypeLabel,
  mergeFichaTypes,
  type FichaType,
} from "@/lib/fichaTypes";
import { fichaIcon, fichaIconTone } from "@/lib/fichaIcons";
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
import { useMutation } from "convex/react";
import {
  BookOpen,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CenterDoc = Doc<"workCenters">;
type FichaDoc = Doc<"fichas">;

/**
 * Etiqueta de un tipo. La lista llega del servidor; mientras carga se usan los
 * cuatro tipos de serie, para que el catálogo nunca aparezca con slugs sueltos.
 */
const labelOf = (kind: string, types: readonly FichaType[]) =>
  fichaTypeLabel(kind, types);

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
      const path = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
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
  selected: Id<"workCenters">[];
  onToggle: (id: Id<"workCenters">) => void;
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

function CreateFichaDialog({
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

function EditFichaDialog({
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
      <DialogContent className="rounded-sm bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Editar ficha
          </DialogTitle>
          <DialogDescription>{labelOf(ficha.kind, types)}</DialogDescription>
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

function DeleteFichaButton({ fichaId }: { fichaId: Id<"fichas"> }) {
  const remove = useMutation(api.fichas.remove);
  const [busy, setBusy] = useState(false);

  const confirmAndDelete = async () => {
    if (!window.confirm("¿Eliminar esta ficha del catálogo?")) return;
    setBusy(true);
    try {
      await remove({ fichaId });
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

  const fichas = useSafeQuery(api.fichas.listMine);
  const adminFichas = useSafeQuery(api.fichas.listAll, isAdmin ? {} : "skip");
  const adminCenters = useSafeQuery(api.access.listCenters, isAdmin ? {} : "skip");
  const myCentersData = useSafeQuery(
    api.access.listMyCenters,
    isAdmin ? "skip" : {},
  );
  // El catálogo trae los tipos visibles; el administrador usa además el panel
  // de gestión, que sí incluye los retirados y cuántas fichas usa cada uno.
  const publicTypes = useSafeQuery(
    api.fichaTypes.listTypes,
    isAdmin ? "skip" : {},
  );
  const adminTypes = useSafeQuery(
    api.fichaTypes.listTypesAdmin,
    isAdmin ? {} : "skip",
  );
  const myCenters = isAdmin ? (adminCenters.data ?? []) : (myCentersData.data ?? []);

  const queryError =
    fichas.error ??
    adminFichas.error ??
    adminCenters.error ??
    myCentersData.error ??
    null;

  const list = isAdmin ? (adminFichas.data ?? fichas.data) : fichas.data;

  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const centerNames = (ids: string[]) =>
    ids
      .map((id) => myCenters.find((c) => c._id === id)?.name)
      .filter(Boolean) as string[];

  // Mientras carga la consulta se usan los cuatro tipos de serie, de modo que
  // el catálogo nunca se pinte con slugs en crudo.
  const types: FichaType[] = useMemo(() => {
    if (!isAdmin) return publicTypes.data ?? mergeFichaTypes([]);
    const loaded = adminTypes.data;
    return loaded
      ? loaded.filter((type) => !type.hidden)
      : mergeFichaTypes([]);
  }, [isAdmin, publicTypes.data, adminTypes.data]);

  const filtered = (list ?? []).filter((f) => {
    if (filter !== "all" && f.kind !== filter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      (f.productName ?? "").toLowerCase().includes(q) ||
      (f.manufacturer ?? "").toLowerCase().includes(q)
    );
  });

  const countOf = (slug: string) =>
    (list ?? []).filter((f) => f.kind === slug).length;

  /**
   * Tipos del filtro: los declarados más cualquier tipo que aparezca en una
   * ficha sin estar en la lista. Así ninguna ficha queda fuera de los filtros
   * por culpa de un catálogo antiguo.
   */
  const railTypes: FichaType[] = useMemo(() => {
    const known = new Set(types.map((type) => type.slug));
    const orphans = [...new Set((list ?? []).map((f) => f.kind))]
      .filter((kind) => !known.has(kind))
      .map((slug) => ({
        slug,
        name: labelOf(slug, types),
        icon: DEFAULT_FICHA_ICON,
        order: Number.MAX_SAFE_INTEGER,
        builtIn: false,
        hidden: false,
      }));
    return [...types, ...orphans];
  }, [types, list]);

  if (queryError) {
    return <ErrorState message={queryError.message} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">Catálogo documental</p>
          <h2 className="font-display mt-2 text-3xl font-semibold">Fichas</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            {isAdmin
              ? "Añade, modifica y elimina fichas del catálogo, define tus propios tipos y asígnalas a los centros de trabajo."
              : "Las fichas de tu centro de trabajo, con su tipo y su documento."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <FichaTypesDialog types={adminTypes.data ?? []} />
            <CreateFichaDialog centers={myCenters} types={types} />
          </div>
        )}
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
          {[
            { value: "all", label: "Todas" },
            ...railTypes.map((type) => ({
              value: type.slug,
              label: type.name,
            })),
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "font-ui cursor-pointer text-sm transition-colors",
                filter === value
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              {value !== "all" && (
                <span className="ml-1 text-xs text-muted-foreground/70">
                  {countOf(value)}
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
            const type = railTypes.find((item) => item.slug === f.kind);
            const Icon = fichaIcon(type?.icon ?? "");
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
                      fichaIconTone(type?.icon ?? ""),
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <Badge
                    variant="secondary"
                    className="font-ui rounded-sm text-[10px] uppercase tracking-wider"
                  >
                    {labelOf(f.kind, types)}
                  </Badge>
                </div>

                <h3 className="font-display mt-4 text-lg leading-snug font-semibold">
                  {f.title}
                </h3>
                {(f.productName || f.manufacturer) && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {f.productName}
                    {f.manufacturer ? ` · ${f.manufacturer}` : ""}
                  </p>
                )}

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
                      <EditFichaDialog
                        ficha={f}
                        centers={myCenters}
                        types={types}
                      />
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
