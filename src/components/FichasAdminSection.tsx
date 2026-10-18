import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useSafeQuery } from "@/hooks/use-safe-query";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/lib/roles";
import { useFichaTranslations } from "@/hooks/use-ficha-translations";
import { mergeFichaTypes, fichaTypeLabel, type FichaType } from "@/lib/fichaTypes";
import { fichaIcon, fichaIconTone } from "@/lib/fichaIcons";
import { ErrorState } from "@/components/ErrorState";
import { CreateFichaDialog } from "@/components/fichas/CreateFichaDialog";
import { EditFichaDialog } from "@/components/fichas/EditFichaDialog";
import { FichaTypesAdminDialog } from "@/components/FichaTypesAdminDialog";
import { FichaCard } from "@/components/fichas/FichaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Search, FileText, ShieldAlert, BookOpenIcon, ListChecks } from "lucide-react";
import { useState, useMemo } from "react";

type FilterType = "all" | string;

export function FichasAdminSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;
  const translateFicha = useFichaTranslations();

  const allFichas = useSafeQuery(api.fichas.listAll);
  const adminTypes = useSafeQuery(api.fichaTypes.listTypesAdmin);
  const centers = useSafeQuery(api.access.listCenters);
  const visibleTypes = useSafeQuery(api.fichaTypes.listTypes);

  const queryError =
    allFichas.error ??
    adminTypes.error ??
    centers.error ??
    visibleTypes.error ??
    null;

  if (queryError) {
    return <ErrorState message={queryError.message} />;
  }

  const types: FichaType[] = useMemo(() => {
    const loaded = adminTypes.data;
    if (!loaded) {
      return mergeFichaTypes([]);
    }
    return loaded.filter((type) => !type.hidden);
  }, [adminTypes.data]);

  const allTypes: FichaType[] = useMemo(() => {
    const loaded = adminTypes.data;
    if (!loaded) {
      return mergeFichaTypes([]);
    }
    return loaded;
  }, [adminTypes.data]);

  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [editFicha, setEditFicha] = useState<Doc<"fichas"> | null>(null);

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
          (f.manufacturer ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [allFichas.data, filter, search]);

  const countOf = (slug: string) =>
    (allFichas.data ?? []).filter((f) => f.kind === slug).length;

  const typeIconMap: Record<string, React.ReactNode> = useMemo(
    () => ({
      ...Object.fromEntries(
        types.map((type) => [type.slug, <IconComponentForSlug key={type.slug} slug={type.slug} />]),
      ),
    }),
    [types],
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="kicker">Administración</p>
        <h2 className="font-display mt-2 text-3xl font-semibold">Fichas</h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Gestión completa del catálogo: crea, edita, retira y organiza las fichas del sistema."
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FichaTypesAdminDialog types={adminTypes.data ?? []} />
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
          {[
            { value: "all", label: "Todas" },
            ...allTypes.map((type) => ({
              value: type.slug,
              label: type.name,
            })),
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value as FilterType)}
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
            const type = allTypes.find((type) => type.slug === f.kind);
            const icon =
              typeIconMap[f.kind] ??
              (() => {
                const fallbackType = types.find(
                  (t) => t.slug === f.kind,
                );
                return fallbackType
                  ? fichaIcon(fallbackType.icon)
                  : fichaIcon("file-text");
              })();

            return (
              <FichaCard
                key={f._id}
                ficha={f}
                types={types}
                icon={icon}
                iconTone={fichaIconTone(type?.icon ?? "file-text")}
                myCenters={centers.data ?? []}
                centerNames={(ids) =>
                  ids
                    .map((id) => centers.data?.find((c) => c._id === id)?.name)
                    .filter(Boolean)
                }
                translateFicha={translateFicha}
                isAdmin={true}
                onEdit={() => setEditFicha(f)}
              />
            );
          })}
        </div>
      )}

      {editFicha && (
        <EditFichaDialog
          ficha={editFicha}
          centers={centers.data ?? []}
          types={types}
          onClose={() => setEditFicha(null)}
        />
      )}
    </div>
  );
}

function IconComponentForSlug({
  slug,
}: {
  slug: string;
}) {
  const iconMap: Record<string, React.ElementType> = {
    ficha_tecnica: FileText,
    ficha_seguridad: ShieldAlert,
    manual_instrucciones: BookOpenIcon,
    instrucciones_trabajo: ListChecks,
  };
  const Component = iconMap[slug] ?? FileText;
  return <Component className="size-4" />;
}
