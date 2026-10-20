import { api } from "@/convex/_generated/api";
import { useSafeQuery } from "@/hooks/use-safe-query";
import { useFichaTranslations } from "@/hooks/use-ficha-translations";
import {
  DEFAULT_FICHA_ICON,
  mergeFichaTypes,
  type FichaType,
} from "@/lib/fichaTypes";
import { fichaIcon, fichaIconTone } from "@/lib/fichaIcons";
import { ErrorState } from "@/components/ErrorState";
import { CreateFichaDialog } from "@/components/fichas/CreateFichaDialog";
import { FichaTypesAdminDialog } from "@/components/FichaTypesAdminDialog";
import { FichaCard } from "@/components/fichas/FichaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Search } from "lucide-react";
import { useState, useMemo } from "react";
import type { AdminFichaType } from "@/lib/fichaTypes";

type FilterType = "all" | string;

type AdminTypeWithCount = FichaType & { fichaCount: number };

function toAdminType(item: AdminTypeWithCount): AdminFichaType {
  return {
    ...item,
    id: item.slug,
  };
}

/**
 * Listado de fichas del panel de administración.
 *
 * Va dentro de `AdminWorkspaceShell`, que ya pone el título y el conmutador de
 * sub-pestañas: aquí sólo se ocupan las acciones y la rejilla.
 */
export function FichasAdminSection() {
  const translateFicha = useFichaTranslations();

  const allFichas = useSafeQuery(api.fichas.listAll);
  const adminTypesRaw = useSafeQuery(api.fichaTypes.listTypesAdmin);
  const centers = useSafeQuery(api.access.listCenters);
  const visibleTypes = useSafeQuery(api.fichaTypes.listTypes);

  const queryError =
    allFichas.error ??
    adminTypesRaw.error ??
    centers.error ??
    visibleTypes.error ??
    null;

  // Ojo: el `return` de error va después de todos los hooks. Un retorno
  // condicional antes de los `useMemo`/`useState` cambia el número de hooks
  // entre renders y React desmonta la pestaña entera con un error.
  const types = useMemo<FichaType[]>(() => {
    const loaded = adminTypesRaw.data;
    if (!loaded) {
      return mergeFichaTypes([]);
    }
    return loaded.filter((type) => !type.hidden);
  }, [adminTypesRaw.data]);

  const allTypes = useMemo<FichaType[]>(() => {
    const loaded = adminTypesRaw.data;
    if (!loaded) {
      return mergeFichaTypes([]);
    }
    return loaded;
  }, [adminTypesRaw.data]);

  const adminTypes = useMemo<AdminFichaType[]>(() => {
    return (adminTypesRaw.data ?? []).map(toAdminType);
  }, [adminTypesRaw.data]);

  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = allFichas.data ?? [];
    return list
      .filter((f) => {
        if (filter !== "all" && f.kind !== filter) return false;
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          f.title.toLowerCase().includes(q) ||
          (f.productName ?? "").toLowerCase().includes(q) ||
          (f.manufacturer ?? "").toLowerCase().includes(q) ||
          (f.contentText ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [allFichas.data, filter, search]);

  const countOf = (slug: string) =>
    (allFichas.data ?? []).filter((f) => f.kind === slug).length;

  const centerNames = (ids: string[]) =>
    ids
      .map((id) => centers.data?.find((c) => c._id === id)?.name)
      .filter(Boolean) as string[];

  if (queryError) {
    return <ErrorState message={queryError.message} />;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <FichaTypesAdminDialog types={adminTypes} />
        <CreateFichaDialog
          centers={centers.data ?? []}
          types={types}
        />
      </div>

      <div className="flex flex-col gap-4 border-b border-border py-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border bg-transparent pl-9 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 dark:focus:ring-ring/30"
            placeholder="Buscar ficha, producto o fabricante…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            { value: "all", label: "Todas" },
            ...allTypes.map((type) => ({
              value: type.slug,
              label: type.name,
            })),
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`font-ui cursor-pointer text-sm transition-colors rounded-sm px-2 py-1 ${
                filter === value
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
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

      {!allFichas.data ? (
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
              : "Aún no hay fichas en el catálogo"}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {search || filter !== "all"
              ? "Prueba con otro término o cambia el filtro."
              : "Crea la primera ficha desde los botones de arriba."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => {
            // El icono vive en el tipo de la ficha; los tipos de serie traen el
            // suyo en `allTypes` aunque no haya fila propia.
            const iconKey =
              allTypes.find((t) => t.slug === f.kind)?.icon ?? DEFAULT_FICHA_ICON;
            const Icon = fichaIcon(iconKey);
            return (
              <FichaCard
                key={f._id}
                ficha={f}
                types={types}
                icon={<Icon className="size-4" />}
                iconTone={fichaIconTone(iconKey)}
                myCenters={centers.data ?? []}
                centerNames={centerNames}
                translateFicha={translateFicha}
                isAdmin={true}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
