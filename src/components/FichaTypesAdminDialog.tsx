import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AdminFichaType } from "@/lib/fichaTypes";
import { FICHA_ICON_OPTIONS, fichaIcon, fichaIconTone } from "@/lib/fichaIcons";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";

type FichaTypesAdminMode = "list" | "create" | "edit";

interface FichaTypesAdminDialogProps {
  types: AdminFichaType[];
  /** Si el diálogo se usa desde la pestaña de fichas, donde los tipos son un complemento.
   *  Si es desde la pestaña de administración, el trigger puede ser distinto. */
  trigger?: React.ReactNode;
}

export function FichaTypesAdminDialog({
  types,
  trigger,
}: FichaTypesAdminDialogProps) {
  const createFichaType = useMutation(api.fichasAdmin.createFichaType);
  const updateFichaType = useMutation(api.fichasAdmin.updateFichaType);
  const retireFichaType = useMutation(api.fichasAdmin.retireFichaType);
  const restoreFichaType = useMutation(api.fichasAdmin.restoreFichaType);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FichaTypesAdminMode>("list");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(FICHA_ICON_OPTIONS[0].key);
  const [busy, setBusy] = useState(false);

  const activeTypes = types.filter((t) => !t.hidden);
  const retiredTypes = types.filter((t) => t.hidden);

  const resetForm = () => {
    setName("");
    setIcon(FICHA_ICON_OPTIONS[0].key);
    setEditingSlug(null);
    setEditingId(null);
    setMode("list");
  };

  const startCreate = () => {
    setMode("create");
    setName("");
    setIcon(FICHA_ICON_OPTIONS[0].key);
    setEditingSlug(null);
    setEditingId(null);
  };

  const startEdit = (type: AdminFichaType) => {
    setMode("edit");
    setEditingSlug(type.slug ?? null);
    setEditingId(type._id ?? null);
    setName(type.name);
    setIcon(type.icon);
  };

  const handleSubmit = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error("El nombre del tipo necesita al menos 2 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        const result = await createFichaType({ name: name.trim(), icon });
        toast.success(
          result.created ? "Tipo de ficha creado." : "Tipo de ficha recuperado.",
        );
      } else {
        const currentType =
          types.find((t) => t._id === editingId) ??
          types.find((t) => t.slug === editingSlug);
        if (currentType) {
          await updateFichaType({
            typeId: currentType._id,
            name: name.trim(),
            icon,
          });
          toast.success("Tipo de ficha actualizado.");
        }
      }
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar el tipo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRetire = async (type: AdminFichaType) => {
    if (
      !confirm(
        `¿Retirar el tipo "${type.name}"? Las fichas con este tipo no podrán usar un tipo retirado.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await retireFichaType({ typeId: type._id });
      toast.success("Tipo retirado.");
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo retirar.");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (type: AdminFichaType) => {
    setBusy(true);
    try {
      await restoreFichaType({ typeId: type._id });
      toast.success("Tipo recuperado.");
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo recuperar.");
    } finally {
      setBusy(false);
    }
  };

  const renderContent = () => {
    if (mode === "list") {
      return (
        <>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Tipos de ficha
            </DialogTitle>
            <DialogDescription>
              Crea, edita, retire y recupera los tipos con los que se clasifican
              las fichas del catálogo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between">
                <p className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
                  Activos
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-ui gap-2 rounded-sm"
                  onClick={startCreate}
                  disabled={busy}
                >
                  <Plus className="size-3.5" />
                  Crear tipo
                </Button>
              </div>

              {activeTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay tipos de ficha activos.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border border border-border">
                  {activeTypes.map((type) => {
                    const Icon = fichaIcon(type.icon);
                    return (
                      <li
                        key={type._id}
                        className="flex items-center gap-3 bg-card px-3 py-2.5"
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-sm border",
                            fichaIconTone(type.icon),
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="block truncate text-sm font-medium">
                            {type.name}
                          </p>
                          <p className="font-ui block text-[11px] text-muted-foreground">
                            {type.builtIn ? "Tipo de serie" : "Creado por admin"}
                            {type.fichaCount > 0 ? ` · ${type.fichaCount} fichas` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="font-ui h-8 cursor-pointer rounded-sm px-2 text-xs text-muted-foreground"
                            onClick={() => startEdit(type)}
                            disabled={busy}
                          >
                            <Pencil className="size-3.5" />
                            <span className="sr-only sm:not-sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="font-ui h-8 cursor-pointer rounded-sm px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleRetire(type)}
                            disabled={busy}
                          >
                            <Trash2 className="size-3.5" />
                            <span className="sr-only">Retirar</span>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {retiredTypes.length > 0 && (
              <section>
                <p className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
                  Retirados
                </p>
                <ul className="mt-3 divide-y divide-border border border-border">
                  {retiredTypes.map((type) => {
                    const Icon = fichaIcon(type.icon);
                    return (
                      <li
                        key={type._id}
                        className="flex items-center gap-3 bg-muted/40 px-3 py-2.5"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="block truncate text-sm text-muted-foreground">
                            {type.name}
                          </p>
                          <p className="font-ui block text-[11px] text-muted-foreground">
                            {type.fichaCount > 0
                              ? `${type.fichaCount} fichas aún lo usan`
                              : "Sin fichas asignadas"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="font-ui h-8 cursor-pointer rounded-sm px-2 text-xs"
                          onClick={() => handleRestore(type)}
                          disabled={busy}
                        >
                          <RotateCcw className="size-3.5" />
                          <span className="sr-only sm:not-sr-only">Recuperar</span>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="font-ui rounded-sm"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </>
      );
    }

    const title = mode === "create" ? "Nuevo tipo de ficha" : "Editar tipo de ficha";
    const submitLabel = mode === "create" ? "Crear tipo" : "Guardar cambios";

    return (
      <>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Define el nombre y el icono del nuevo tipo de ficha."
              : `Edita el tipo “${name}”. El identificador no cambia.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Nombre
            </Label>
            <Input
              className="rounded-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Permiso de trabajo"
              disabled={busy}
            />
          </div>

          <div>
            <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Icono
            </Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FICHA_ICON_OPTIONS.map((option) => {
                const Icon = fichaIcon(option.key);
                const selected = icon === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={busy}
                    aria-label={option.label}
                    aria-pressed={selected}
                    onClick={() => setIcon(option.key)}
                    className={cn(
                      "flex size-9 cursor-pointer items-center justify-center rounded-sm border transition-colors",
                      selected
                        ? "border-foreground bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/40",
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="sr-only">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="font-ui rounded-sm"
            onClick={() => setMode("list")}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            className="font-ui gap-2 rounded-sm"
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : mode === "create" ? (
              <Plus className="size-3.5" />
            ) : (
              <Pencil className="size-3.5" />
            )}
            {submitLabel}
          </Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild={!trigger}>
        {trigger ?? (
          <Button variant="outline" className="font-ui cursor-pointer gap-2 rounded-sm">
            <Layers className="size-4" />
            Tipos de ficha
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-sm bg-card sm:max-w-xl">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
