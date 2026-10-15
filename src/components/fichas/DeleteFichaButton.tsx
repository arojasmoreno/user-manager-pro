import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function DeleteFichaButton({ fichaId }: { fichaId: Id<"fichas"> }) {
  const remove = useMutation(api.fichas.remove);
  const [busy, setBusy] = useState(false);

  const confirmAndDelete = async () => {
    if (!window.confirm("¿Eliminar esta ficha del catálogo?")) return;
    setBusy(true);
    try {
      await remove({ fichaId });
      toast.success("Ficha eliminada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="font-ui h-8 px-2 text-xs text-destructive hover:text-destructive"
      onClick={confirmAndDelete}
      disabled={busy}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
