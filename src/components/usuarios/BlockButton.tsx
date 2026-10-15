import { api } from "@/convex/_generated/api";
import type { UserRow } from "@/components/usuarios/EditUserDialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "convex/react";
import { Ban, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function BlockButton({
  target,
  isSelf,
}: {
  target: UserRow;
  isSelf: boolean;
}) {
  const setUserBlocked = useMutation(api.access.setUserBlocked);
  const [busy, setBusy] = useState(false);
  const isBlocked = target.blocked === true;

  const handle = async () => {
    setBusy(true);
    try {
      await setUserBlocked({ userId: target._id, blocked: !isBlocked });
      toast.success(isBlocked ? "Usuario desbloqueado." : "Usuario bloqueado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="font-ui h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
      onClick={handle}
      disabled={busy || isSelf}
      title={isSelf ? "No puedes bloquear tu propia cuenta" : undefined}
    >
      {isBlocked ? (
        <>
          <UserRoundCheck className="size-3.5" />
          Desbloquear
        </>
      ) : (
        <>
          <Ban className="size-3.5" />
          Bloquear
        </>
      )}
    </Button>
  );
}
