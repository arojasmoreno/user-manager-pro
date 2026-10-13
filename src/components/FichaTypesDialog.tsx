import { api } from "@/convex/_generated/api";
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
  DEFAULT_FICHA_ICON,
  isFichaIcon,
  type AdminFichaType,
  type FichaIconKey,
} from "@/lib/fichaTypes";
import { FICHA_ICON_OPTIONS, fichaIcon, fichaIconTone } from "@/lib/fichaIcons";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import {
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Gestión de los tipos de ficha del catálogo.
 *
 * El administrador crea los tipos que necesite, los renombra, les cambia el
 * icono y los retira. Un tipo se niega a borrarse mientras haya fichas que lo
 * usen (lo decide el backend), y recuperarlo es inmediato.
 */
export function FichaTypesDialog({ types }: { types: AdminFichaType[] }) {
  const createType = useMutation(api.fichaTypes.createType);
  const updateType = useMutation(api.fichaTypes.updateType);
  const deleteType = useMutation(api.fichaTypes.deleteType);
  const restoreType = useMutation(api.fichaTypes.restoreType);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<FichaIconKey>(DEFAULT_FICHA_ICON);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = types.filter((type) => !type.hidden);
  const retired = types.filter((type) => type.hidden);

  const resetForm = () => {
    setName("");
    setIcon(DEFAULT_FICHA_ICON);
    setEditingSlug(null);
  };

  const startEditing = (type: AdminFichaType) => {
    setEditingSlug(type.slug);
    setName(type.name);
    setIcon(isFichaIcon(type.icon) ? type.icon : DEFAULT_FICHA_ICON);
  };

  const submit = async () => {
    const clean = name.trim();
    if (clean.length < 2) {
      toast.error("El nombre del tipo necesita al menos 2 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (editingSlug) {
        await updateType({ slug: editingSlug, name: clean, icon });
        toast.success("Tipo de ficha actualizado.");
      } else {
        const result = await createType({ name: clean, icon });
        toast.success(
          result.created
            ? "Tipo de ficha creado."
            : "Tipo de ficha recuperado.",
        );
      }
      resetForm();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se ha podido guardar el tipo de ficha.",
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmAndDelete = async (type: AdminFichaType) => {
    if (!window.confirm(`¿Borrar el tipo «${type.name}»?`)) return;
    setBusy(true);
    try {
      await deleteType({ slug: type.slug });
      toast.success("Tipo de ficha borrado.");
      if (editingSlug === type.slug) resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido borrar.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async (type: AdminFichaType) => {
    setBusy(true);
    try {
      await restoreType({ slug: type.slug });
      toast.success("Tipo de ficha recuperado.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se ha podido recuperar.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="font-ui cursor-pointer gap-2 rounded-sm">
          <Layers className="size-4" />
          Tipos de ficha
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm bg-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Tipos de ficha
          </DialogTitle>
          <DialogDescription>
            Crea los tipos que necesite tu catálogo, renómbralos o retíralos.
            Cada ficha se asigna después a uno de ellos.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-6 overflow-y-auto py-2 pr-1">
          {/* Alta y edición comparten formulario: editar rellena estos campos. */}
          <div className="space-y-3 border-b border-border pb-5">
            <p className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              {editingSlug ? "Editar tipo" : "Nuevo tipo"}
            </p>
            <div className="grid gap-2">
              <Label
                htmlFor="ficha-type-name"
                className="font-ui text-xs uppercase tracking-wider text-muted-foreground"
              >
                Nombre
              </Label>
              <Input
                id="ficha-type-name"
                className="rounded-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Permiso de trabajo"
                disabled={busy}
              />
            </div>
            <div className="grid gap-2">
              <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
                Icono
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {FICHA_ICON_OPTIONS.map((option) => {
                  const Icon = fichaIcon(option.key);
                  const selected = icon === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      title={option.label}
                      aria-label={option.label}
                      aria-pressed={selected}
                      disabled={busy}
                      onClick={() => setIcon(option.key)}
                      className={cn(
                        "flex size-9 cursor-pointer items-center justify-center rounded-sm border transition-colors",
                        selected
                          ? "border-foreground bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-foreground/40",
                      )}
                    >
                      <Icon className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="font-ui cursor-pointer gap-2 rounded-sm"
                onClick={submit}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : editingSlug ? (
                  <Pencil className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {editingSlug ? "Guardar cambios" : "Añadir tipo"}
              </Button>
              {editingSlug && (
                <Button
                  variant="outline"
                  className="font-ui cursor-pointer rounded-sm"
                  onClick={resetForm}
                  disabled={busy}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Tipos del catálogo
            </p>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No queda ningún tipo activo. Añade uno para poder clasificar
                fichas.
              </p>
            ) : (
              <ul className="divide-y divide-border border border-border">
                {active.map((type) => {
                  const Icon = fichaIcon(type.icon);
                  return (
                    <li
                      key={type.slug}
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
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {type.name}
                        </span>
                        <span className="font-ui block text-[11px] text-muted-foreground">
                          {type.fichaCount === 0
                            ? "Sin fichas"
                            : type.fichaCount === 1
                              ? "1 ficha"
                              : `${type.fichaCount} fichas`}
                          {type.builtIn ? " · Tipo de serie" : ""}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-ui h-8 cursor-pointer rounded-sm px-2 text-xs text-muted-foreground"
                        onClick={() => startEditing(type)}
                        disabled={busy}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only sm:not-sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-ui h-8 cursor-pointer rounded-sm px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => confirmAndDelete(type)}
                        disabled={busy}
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Borrar</span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {retired.length > 0 && (
            <div className="space-y-2">
              <p className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
                Retirados
              </p>
              <ul className="divide-y divide-border border border-border">
                {retired.map((type) => {
                  const Icon = fichaIcon(type.icon);
                  return (
                    <li
                      key={type.slug}
                      className="flex items-center gap-3 bg-muted/40 px-3 py-2.5"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {type.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="font-ui rounded-sm text-[10px] uppercase tracking-wider"
                      >
                        Retirado
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-ui h-8 cursor-pointer rounded-sm px-2 text-xs"
                        onClick={() => restore(type)}
                        disabled={busy}
                      >
                        <RotateCcw className="size-3.5" />
                        Recuperar
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <p className="font-ui mr-auto text-[11px] text-muted-foreground">
            Un tipo con fichas asignadas no se puede borrar.
          </p>
          <Button
            variant="outline"
            className="font-ui cursor-pointer rounded-sm"
            onClick={() => setOpen(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
