import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useSafeQuery } from "@/hooks/use-safe-query";
import { FichasAdminSection } from "@/components/FichasAdminSection";
import { FichaTypesAdminDialog } from "@/components/FichaTypesAdminDialog";
import { UsagePanel } from "@/components/UsagePanel";
import { Skeleton } from "@/components/ui/skeleton";
import { fichaIcon, fichaIconTone } from "@/lib/fichaIcons";
import { cn } from "@/lib/utils";
import type { AdminFichaType } from "@/lib/fichaTypes";

type AdminSubTab = "types" | "fichas" | "usage";

const SUBTABS: { id: AdminSubTab; label: string }[] = [
  { id: "types", label: "Tipos de ficha" },
  { id: "fichas", label: "Fichas" },
  { id: "usage", label: "Uso" },
];

export function AdminWorkspaceShell() {
  const [tab, setTab] = useState<AdminSubTab>("types");

  const adminTypes = useSafeQuery(api.fichaTypes.listTypesAdmin);
  const types: AdminFichaType[] =
    adminTypes.data?.map(
      (type): AdminFichaType => ({
        ...type,
        id: type.slug,
      }),
    ) ?? [];

  const activeTypes = types.filter((type) => !type.hidden);
  const retiredTypes = types.filter((type) => type.hidden);

  return (
    <div className="space-y-8">
      <div>
        <p className="kicker">Administración</p>
        <h2 className="font-display mt-2 text-3xl font-semibold">
          {tab === "types" ? "Tipos de ficha" : tab === "usage" ? "Uso del catálogo" : "Fichas"}
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          {tab === "types"
            ? "Define los tipos y categorías con los que se clasifican las fichas del catálogo."
            : tab === "usage"
              ? "Qué documentos se consultan y cuáles no se abren nunca."
              : "Gestión completa del catálogo: crea, edita, retira y organiza las fichas del sistema."}
        </p>
      </div>

      {/* Sin este conmutador la vista quedaba fijada en «Tipos» y la gestión de
          fichas del administrador era inalcanzable. */}
      <div className="flex gap-2">
        {SUBTABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "font-ui cursor-pointer rounded-sm border px-3 py-1.5 text-sm transition-colors",
              tab === item.id
                ? "border-foreground bg-foreground font-medium text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "usage" ? (
        <UsagePanel />
      ) : tab === "fichas" ? (
        <FichasAdminSection />
      ) : (
        <div className="space-y-8">
          <FichaTypesAdminDialog types={types} />

          {!adminTypes.data ? (
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-sm border border-border bg-card p-3"
                >
                  <Skeleton className="size-8 rounded-sm" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-32 rounded-sm" />
                    <Skeleton className="mt-1 h-3 w-20 rounded-sm" />
                  </div>
                </div>
              ))}
            </div>
          ) : types.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay tipos de ficha aún. Usa «Tipos de ficha» para crear el
              primero.
            </p>
          ) : (
            /* La lista se pinta también aquí, no sólo dentro del diálogo: así
               la pestaña muestra sus elementos de un vistazo. */
            <ul className="divide-y divide-border border border-border">
              {[...activeTypes, ...retiredTypes].map((type) => {
                const Icon = fichaIcon(type.icon);
                return (
                  <li
                    key={type.slug}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5",
                      type.hidden ? "bg-muted/40" : "bg-card",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-sm border",
                        type.hidden
                          ? "border-border text-muted-foreground"
                          : fichaIconTone(type.icon),
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "block truncate text-sm font-medium",
                          type.hidden && "text-muted-foreground",
                        )}
                      >
                        {type.name}
                      </p>
                      <p className="font-ui block text-[11px] text-muted-foreground">
                        {type.hidden
                          ? "Retirado"
                          : type.builtIn
                            ? "Tipo de serie"
                            : "Creado por admin"}
                        {type.fichaCount > 0 ? ` · ${type.fichaCount} fichas` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
