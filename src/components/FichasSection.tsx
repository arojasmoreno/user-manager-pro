import { ErrorState } from "@/components/ErrorState";
import { FichaTypesDialog } from "@/components/FichaTypesDialog";
import { CreateFichaDialog } from "@/components/fichas/CreateFichaDialog";
import { FichaCard } from "@/components/fichas/FichaCard";
import { FichaFilters } from "@/components/fichas/FichaFilters";
import { useFichasCatalog } from "@/hooks/use-fichas";
import { fichaIcon, fichaIconTone } from "@/lib/fichaIcons";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen } from "lucide-react";
import { useState } from "react";

export function FichasSection() {
  const {
    isAdmin,
    list,
    types,
    adminTypes,
    railTypes,
    myCenters,
    centerNames,
    translateFicha,
    queryError,
  } = useFichasCatalog();

  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = (list ?? []).filter((f) => {
    if (filter !== "all" && f.kind !== filter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    // Se busca en los dos idiomas: el de la persona y el original.
    const shown = translateFicha(f);
    return [
      f.title,
      f.productName,
      f.manufacturer,
      shown.title,
      shown.productName,
      shown.manufacturer,
    ].some((value) => (value ?? "").toLowerCase().includes(q));
  });

  const countOf = (slug: string) =>
    (list ?? []).filter((f) => f.kind === slug).length;

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
            <FichaTypesDialog types={adminTypes} />
            <CreateFichaDialog centers={myCenters} types={types} />
          </div>
        )}
      </div>

      <FichaFilters
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        railTypes={railTypes}
        countOf={countOf}
      />

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
              <FichaCard
                key={f._id}
                ficha={f}
                types={types}
                icon={<Icon className="size-4" />}
                iconTone={fichaIconTone(type?.icon ?? "")}
                myCenters={myCenters}
                centerNames={centerNames}
                translateFicha={translateFicha}
                isAdmin={isAdmin}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
