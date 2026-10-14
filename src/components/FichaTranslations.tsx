import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSafeQuery } from "@/hooks/use-safe-query";
import { errorText } from "@/lib/convexErrors";
import { LOCALES, SOURCE_LOCALE, type Locale } from "@/i18n/locales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Languages, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

type TranslationRow = {
  locale: string;
  title: string;
  productName?: string;
  manufacturer?: string;
  source: "ai" | "manual";
};

/** Idiomas que necesitan traducción: los pedidos menos el de origen. */
const TARGETS = LOCALES.filter((l) => l.code !== SOURCE_LOCALE);

const emptyDraft = { title: "", productName: "", manufacturer: "" };

/**
 * Traducciones de una ficha, para el administrador.
 *
 * Cada idioma se puede traducir con la IA, corregir a mano o quitar. La ficha
 * original no se toca nunca: la traducción es una capa encima, y lo que falte se
 * sigue viendo en español.
 */
export function FichaTranslations({
  fichaId,
  enabled,
}: {
  fichaId: Id<"fichas">;
  enabled: boolean;
}) {
  const { data, error } = useSafeQuery(
    api.traducciones.listByFicha,
    enabled ? { fichaId } : "skip",
  );
  const translate = useAction(api.traduccionesAi.translateFicha);
  const save = useMutation(api.traducciones.saveTranslation);
  const remove = useMutation(api.traducciones.deleteTranslation);

  const [busyLocale, setBusyLocale] = useState<Locale | null>(null);
  /** Cuántos idiomas está traduciendo la acción "traducir los que faltan". */
  const [pending, setPending] = useState(0);
  const [editing, setEditing] = useState<Locale | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const rows: TranslationRow[] = data ?? [];
  const stored = new Map(rows.map((row) => [row.locale, row]));
  const missing = TARGETS.filter((target) => !stored.has(target.code));
  const busy = busyLocale !== null || pending > 0;

  const runTranslation = async (locale: Locale, name: string) => {
    setBusyLocale(locale);
    try {
      await translate({ fichaId, locale });
      toast.success(`Traducción a ${name} lista. Repásala antes de darla por buena.`);
    } catch (err) {
      toast.error(errorText(err, "No se ha podido traducir la ficha."));
    } finally {
      setBusyLocale(null);
    }
  };

  const translateMissing = async () => {
    if (missing.length === 0) return;
    setPending(missing.length);
    let done = 0;
    let firstError: string | null = null;
    for (const target of missing) {
      try {
        await translate({ fichaId, locale: target.code });
        done += 1;
      } catch (err) {
        firstError ??= errorText(err, "No se ha podido traducir la ficha.");
      } finally {
        setPending((left) => Math.max(0, left - 1));
      }
    }
    if (done > 0) {
      toast.success(
        done === TARGETS.length
          ? `Traducida a los ${done} idiomas. Repásalas antes de darlas por buenas.`
          : `Traducida a ${done} de ${TARGETS.length} idiomas.`,
      );
    }
    if (firstError) toast.error(firstError);
  };

  const startEditing = (row: TranslationRow | undefined, locale: Locale) => {
    setEditing(locale);
    setDraft({
      title: row?.title ?? "",
      productName: row?.productName ?? "",
      manufacturer: row?.manufacturer ?? "",
    });
  };

  const saveDraft = async (locale: Locale, name: string) => {
    if (draft.title.trim() === "") {
      toast.error("El título traducido no puede estar vacío.");
      return;
    }
    setBusyLocale(locale);
    try {
      await save({
        fichaId,
        locale,
        title: draft.title,
        productName: draft.productName.trim() || undefined,
        manufacturer: draft.manufacturer.trim() || undefined,
      });
      toast.success(`Traducción a ${name} guardada.`);
      setEditing(null);
    } catch (err) {
      toast.error(errorText(err, "No se ha podido guardar."));
    } finally {
      setBusyLocale(null);
    }
  };

  const drop = async (locale: Locale, name: string) => {
    if (!window.confirm(`¿Quitar la traducción a ${name}? La ficha se verá en español.`)) {
      return;
    }
    setBusyLocale(locale);
    try {
      await remove({ fichaId, locale });
      toast.success(`Traducción a ${name} retirada.`);
      if (editing === locale) setEditing(null);
    } catch (err) {
      toast.error(errorText(err, "No se ha podido quitar."));
    } finally {
      setBusyLocale(null);
    }
  };

  return (
    <section className="grid gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-ui flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Languages className="size-3.5" />
            Traducciones
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada persona ve la ficha en su idioma; lo que falte se muestra en
            español.
          </p>
        </div>
        {missing.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-ui gap-2 rounded-sm"
            disabled={busy}
            onClick={() => void translateMissing()}
          >
            {pending > 0 ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Traducir los {missing.length} que faltan
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">
          No se han podido cargar las traducciones: {error.message}
        </p>
      )}

      <ul className="divide-y divide-border border border-border">
        {TARGETS.map((target) => {
          const row = stored.get(target.code);
          const isEditing = editing === target.code;
          const isBusy = busyLocale === target.code;

          return (
            <li key={target.code} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {target.short}
                    {row ? (
                      <Badge
                        variant="secondary"
                        className="font-ui gap-1 rounded-sm text-[10px] uppercase tracking-wider"
                      >
                        {row.source === "ai" ? (
                          <Sparkles className="size-2.5" />
                        ) : (
                          <Check className="size-2.5" />
                        )}
                        {row.source === "ai" ? "IA" : "Manual"}
                      </Badge>
                    ) : (
                      <span className="font-ui text-[11px] text-muted-foreground">
                        Sin traducir
                      </span>
                    )}
                  </p>
                  {!isEditing && row && (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {row.title}
                      {row.productName ? ` · ${row.productName}` : ""}
                      {row.manufacturer ? ` · ${row.manufacturer}` : ""}
                    </p>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="font-ui h-8 gap-1.5 px-2 text-xs"
                      disabled={busy}
                      onClick={() => void runTranslation(target.code, target.short)}
                    >
                      {isBusy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      {row ? "Traducir de nuevo" : "Traducir con IA"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="font-ui h-8 px-2 text-xs text-muted-foreground"
                      disabled={busy}
                      onClick={() => startEditing(row, target.code)}
                    >
                      Escribir a mano
                    </Button>
                    {row && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:text-destructive"
                        disabled={busy}
                        title="Quitar la traducción"
                        onClick={() => void drop(target.code, target.short)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="mt-3 grid gap-3">
                  <div className="grid gap-2">
                    <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
                      Título en {target.short}
                    </Label>
                    <Input
                      className="rounded-sm"
                      value={draft.title}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, title: e.target.value }))
                      }
                      placeholder="Título traducido"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      className="rounded-sm"
                      value={draft.productName}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, productName: e.target.value }))
                      }
                      placeholder="Producto (opcional)"
                    />
                    <Input
                      className="rounded-sm"
                      value={draft.manufacturer}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, manufacturer: e.target.value }))
                      }
                      placeholder="Fabricante (opcional)"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="font-ui gap-2 rounded-sm"
                      disabled={isBusy}
                      onClick={() => void saveDraft(target.code, target.short)}
                    >
                      {isBusy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-ui gap-2 rounded-sm"
                      disabled={isBusy}
                      onClick={() => setEditing(null)}
                    >
                      <X className="size-3.5" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
