import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type CenterDoc = Doc<"workCenters">;

/** Center multi-select chips shared by create/edit dialogs. */
export function CenterPicker({
  centers,
  selected,
  onToggle,
}: {
  centers: CenterDoc[];
  selected: Id<"workCenters">[];
  onToggle: (id: Id<"workCenters">) => void;
}) {
  if (centers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Crea primero un centro de trabajo en la pestaña «Centros».
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {centers.map((c) => (
        <button
          key={c._id}
          type="button"
          onClick={() => onToggle(c._id)}
          className={cn(
            "font-ui rounded-sm border px-3 py-1.5 text-xs transition-colors",
            selected.includes(c._id)
              ? "border-foreground bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-foreground/40",
          )}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
