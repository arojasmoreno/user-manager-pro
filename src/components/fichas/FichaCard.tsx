import type { Doc } from "@/convex/_generated/dataModel";
import { EditFichaDialog } from "@/components/fichas/EditFichaDialog";
import { DeleteFichaButton } from "@/components/fichas/DeleteFichaButton";
import { FichaQrDialog } from "@/components/fichas/FichaQrDialog";
import { fichaTypeLabel, type FichaType } from "@/lib/fichaTypes";
import type { FichaFields, TranslatedFields } from "@/hooks/use-ficha-translations";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Eye } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

type CenterDoc = Doc<"workCenters">;
type FichaDoc = Doc<"fichas">;

/** One catalogue entry: icon, translated text, centers and admin actions. */
export function FichaCard({
  ficha,
  types,
  icon,
  iconTone,
  myCenters,
  centerNames,
  translateFicha,
  isAdmin,
}: {
  ficha: FichaDoc;
  types: readonly FichaType[];
  /** El icono ya construido por quien lista las fichas (evita crearlo aquí). */
  icon: ReactNode;
  iconTone: string;
  myCenters: CenterDoc[];
  centerNames: (ids: string[]) => string[];
  translateFicha: (ficha: FichaFields) => TranslatedFields;
  isAdmin: boolean;
}) {
  const shown = translateFicha(ficha);

  return (
    <article
      className={cn(
        "group flex flex-col rounded-sm border bg-card p-6 transition-shadow hover:shadow-[0_1px_0_0_var(--border),0_8px_24px_-16px_rgba(0,0,0,0.25)]",
        !ficha.active && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-sm border",
            iconTone,
          )}
        >
          {icon}
        </div>
        <Badge
          variant="secondary"
          className="font-ui rounded-sm text-[10px] uppercase tracking-wider"
        >
          {fichaTypeLabel(ficha.kind, types)}
        </Badge>
      </div>

      <h3 className="font-display mt-4 text-lg leading-snug font-semibold">
        {shown.title}
      </h3>
      {(shown.productName || shown.manufacturer) && (
        <p className="mt-1 text-sm text-muted-foreground">
          {shown.productName}
          {shown.manufacturer ? ` · ${shown.manufacturer}` : ""}
        </p>
      )}
      {isAdmin && shown.isFallback && (
        <p className="font-ui mt-1 text-[11px] text-muted-foreground/80">
          Sin traducir
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {centerNames(ficha.workCenterIds).map((name) => (
          <span
            key={name}
            className="font-ui rounded-sm border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {name}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
        {/* El visor embebe el PDF en la app y registra la apertura. */}
        <Link
          to={`/fichas/${ficha._id}`}
          className="font-ui inline-flex items-center gap-1.5 text-xs font-medium underline-offset-4 hover:underline"
        >
          <Eye className="size-3" />
          Ver documento
        </Link>
        <a
          href={ficha.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-ui inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Pestaña nueva
          <ExternalLink className="size-3" />
        </a>
        {isAdmin && (
          <div className="ml-auto flex items-center gap-1">
            <FichaQrDialog fichaId={ficha._id} title={shown.title} />
            <EditFichaDialog ficha={ficha} centers={myCenters} types={types} />
            <DeleteFichaButton fichaId={ficha._id} />
          </div>
        )}
      </div>
    </article>
  );
}
