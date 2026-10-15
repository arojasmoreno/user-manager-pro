import { api } from "@/convex/_generated/api";
import type { UserRow } from "@/components/usuarios/EditUserDialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function DeleteUserButton({ target }: { target: UserRow }) {
  const deleteUser = useMutation(api.access.deleteUser);
  const [busy, setBusy] = useState(false);

  const confirmAndDelete = async () => {
    if (
      !window.confirm(
        `¿Eliminar la cuenta de ${target.name || target.email}? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteUser({ userId: target._id });
      toast.success("Cuenta eliminada.");
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
