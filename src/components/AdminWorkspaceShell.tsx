import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useSafeQuery } from "@/hooks/use-safe-query";
import { FichasAdminSection } from "@/components/FichasAdminSection";
import { FichaTypesAdminDialog } from "@/components/FichaTypesAdminDialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminFichaType } from "@/lib/fichaTypes";

type AdminSubTab = "types" | "fichas";

export function AdminWorkspaceShell() {
  const [tab, setTab] = useState<AdminSubTab>("types");

  const adminTypes = useSafeQuery(api.fichaTypes.listTypesAdmin);
  const types: AdminFichaType[] = adminTypes.data?.map(
    (type): AdminFichaType => ({
      ...type,
      id: type.slug,
    }),
  ) ?? [];

  if (tab === "types") {
    return (
      <div className="space-y-8">
        <div>
          <p className="kicker">Administración</p>
          <h2 className="font-display mt-2 text-3xl font-semibold">
            Tipos de ficha
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Define los tipos y categorías con los que se clasifican las fichas del catálogo.
          </p>
        </div>

        <FichaTypesAdminDialog types={types} />

        {!adminTypes.data ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-card rounded-sm border border-border p-3"
              >
                <Skeleton className="size-8 rounded-sm" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-32 rounded-sm" />
                  <Skeleton className="h-3 w-20 mt-1 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : types.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay tipos de ficha aún. Usa "Tipos de ficha" para crear el primero.
          </p>
        ) : null}
      </div>
    );
  }

  return <FichasAdminSection />;
}
