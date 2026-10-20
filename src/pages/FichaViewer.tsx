import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSafeQuery } from "@/hooks/use-safe-query";
import { fichaTypeLabel, mergeFichaTypes } from "@/lib/fichaTypes";
import { fichaIcon, fichaIconTone } from "@/lib/fichaIcons";
import { BackToHome } from "@/components/BackToHome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ExternalLink,
  History,
  Loader2,
} from "lucide-react";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router";

/**
 * Ruta de una ficha (`/fichas/:id`) que embebe el documento en la propia app.
 *
 * Existe sobre todo para que un QR pegado en la máquina abra directamente el
 * PDF correcto sin tener que buscar en el catálogo. Al mostrarse registra la
 * apertura (mejora del panel de uso) y ofrece el histórico de versiones.
 */
export default function FichaViewer() {
  const { id } = useParams<{ id: string }>();
  const fichaId = id as Id<"fichas"> | undefined;

  const ficha = useSafeQuery(
    api.fichas.getById,
    fichaId ? { fichaId } : "skip",
  );
  const versions = useSafeQuery(
    api.fichas.listVersions,
    fichaId ? { fichaId } : "skip",
  );
  const registerOpen = useMutation(api.fichas.registerOpen);

  // Se registra la apertura una sola vez por visita, tras cargar la ficha.
  const registered = useRef(false);
  useEffect(() => {
    if (!ficha.data || !fichaId || registered.current) return;
    registered.current = true;
    void registerOpen({ fichaId }).catch(() => {
      // El contador es best effort: no debe romper la visualización.
    });
  }, [ficha.data, fichaId, registerOpen]);

  if (!fichaId) {
    return <ViewerNotice title="Ficha no encontrada" />;
  }
  if (ficha.error) {
    return <ViewerNotice title="No se ha podido cargar la ficha" />;
  }
  if (!ficha.data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-8 w-64 rounded-sm" />
          <Skeleton className="h-[70vh] w-full rounded-sm" />
        </div>
      </div>
    );
  }

  const data = ficha.data;
  const Icon = fichaIcon("");
  const typeLabel = fichaTypeLabel(data.kind, mergeFichaTypes([]));
  const isPdf = /\.pdf(\?|#|$)/i.test(data.url);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-9 items-center justify-center rounded-sm border ${fichaIconTone("")}`}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display truncate text-xl font-semibold">
              {data.title}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge
                variant="secondary"
                className="font-ui rounded-sm text-[10px] uppercase tracking-wider"
              >
                {typeLabel}
              </Badge>
              {data.productName && (
                <span className="truncate text-xs text-muted-foreground">
                  {data.productName}
                  {data.manufacturer ? ` · ${data.manufacturer}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-ui inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            Abrir en otra pestaña
            <ExternalLink className="size-3" />
          </a>
          <BackToHome />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-10">
        {isPdf ? (
          <iframe
            title={`Documento: ${data.title}`}
            src={data.url}
            className="h-[78vh] w-full rounded-sm border border-border bg-card"
          />
        ) : (
          <div className="space-y-4">
            <div className="border border-dashed border-border bg-card/50 p-10 text-center">
              <AlertTriangle className="mx-auto size-8 text-muted-foreground/60" />
              <p className="font-display mt-4 text-lg">
                Este documento no se puede previsualizar
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                No es un PDF, así que el navegador no lo muestra dentro de la
                app. Ábrelo en una pestaña nueva para consultarlo.
              </p>
            </div>
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-ui inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Abrir documento
              <ExternalLink className="size-4" />
            </a>
          </div>
        )}

        {versions.data && versions.data.length > 0 && (
          <section className="mt-8">
            <h2 className="font-ui flex items-center gap-2 text-sm font-medium">
              <History className="size-4 text-muted-foreground" />
              Versiones anteriores ({versions.data.length})
            </h2>
            <ul className="mt-3 divide-y divide-border border border-border">
              {versions.data.map((v) => (
                <li
                  key={v._id}
                  className="flex flex-wrap items-center justify-between gap-2 bg-card px-4 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{v.title}</span>
                    <span className="font-ui text-[11px] text-muted-foreground">
                      {new Date(v.at).toLocaleString("es-ES")}
                    </span>
                  </span>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-ui inline-flex shrink-0 items-center gap-1 text-xs underline-offset-4 hover:underline"
                  >
                    Abrir
                    <ExternalLink className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function ViewerNotice({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <AlertTriangle className="size-8 text-muted-foreground/60" />
      <p className="font-display text-xl font-semibold">{title}</p>
      <Link
        to="/dashboard"
        className="font-ui inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Volver al catálogo
      </Link>
      <BackToHome />
    </div>
  );
}
