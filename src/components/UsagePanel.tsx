import { api } from "@/convex/_generated/api";
import { useSafeQuery } from "@/hooks/use-safe-query";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, FileQuestion, TrendingUp } from "lucide-react";

/**
 * Informe de uso del catálogo (sólo administrador).
 *
 * Muestra las fichas que más se abren y las que nadie ha abierto aún, para
 * saber qué documentos se consultan de verdad y cuáles se pueden retirar.
 */
export function UsagePanel() {
  const stats = useSafeQuery(api.fichas.usageStats);

  if (stats.error) {
    return (
      <p className="text-sm text-destructive">
        No se ha podido cargar el informe de uso.
      </p>
    );
  }

  if (!stats.data) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-sm" />
        ))}
      </div>
    );
  }

  const { mostOpened, neverOpened, totalOpens } = stats.data;
  const max = mostOpened[0]?.openCount ?? 1;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 rounded-sm border border-border bg-card px-4 py-3">
        <BarChart3 className="size-5 text-muted-foreground" />
        <div>
          <p className="font-display text-2xl font-semibold">{totalOpens}</p>
          <p className="text-xs text-muted-foreground">
            aperturas de documento en total
          </p>
        </div>
      </div>

      <section>
        <h3 className="font-ui flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="size-4 text-muted-foreground" />
          Más consultadas
        </h3>
        {mostOpened.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía nadie ha abierto ningún documento. Aparecerán aquí según se
            vayan consultando.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mostOpened.map((f) => (
              <li key={f._id} className="rounded-sm border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {f.title}
                  </span>
                  <span className="font-ui shrink-0 text-xs text-muted-foreground">
                    {f.openCount} {f.openCount === 1 ? "apertura" : "aperturas"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${Math.max(8, (f.openCount / max) * 100)}%` }}
                  />
                </div>
                {f.lastOpenedAt && (
                  <p className="font-ui mt-1.5 text-[11px] text-muted-foreground">
                    Última vez: {new Date(f.lastOpenedAt).toLocaleString("es-ES")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-ui flex items-center gap-2 text-sm font-medium">
          <FileQuestion className="size-4 text-muted-foreground" />
          Nunca abiertas
          <span className="text-muted-foreground">({neverOpened.length})</span>
        </h3>
        {neverOpened.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Todas las fichas se han abierto al menos una vez.
          </p>
        ) : (
          <>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
              Estas fichas no se ha abierto nunca: repísalas por si se puedan
              retirar o si falta asignarlas al centro adecuado.
            </p>
            <ul className="mt-3 divide-y divide-border border border-border">
              {neverOpened.map((f) => (
                <li key={f._id} className="bg-card px-3 py-2 text-sm text-muted-foreground">
                  {f.title}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
