import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSafeQuery } from "@/hooks/use-safe-query";
import { useMutation } from "convex/react";
import { toast } from "sonner";

/**
 * Datos de la pestaña de usuarios: la cuenta actual, las cuentas, los centros y
 * las invitaciones, más las invitaciones pendientes y la acción de revocarlas.
 *
 * IMPORTANTE: el orden de las consultas está fijado (currentUser, listUsers,
 * listCenters, listInvites). El test de pestañas sustituye las consultas por
 * una cola en ese orden; no reordenar sin actualizar el test.
 */
export function useUsuariosData() {
  const me = useSafeQuery(api.users.currentUser);
  const users = useSafeQuery(api.access.listUsers);
  const centers = useSafeQuery(api.access.listCenters);
  const invites = useSafeQuery(api.access.listInvites);
  const revokeInvite = useMutation(api.access.revokeInvite);
  const resendInvite = useMutation(api.access.resendInvite);

  const queryError =
    users.error ?? centers.error ?? invites.error ?? me.error ?? null;

  const now = Date.now();
  // Una invitación pendiente caducada no sirve: se muestra aparte para que el
  // administrador sepa que hay que reenviarla en lugar de esperar en balde.
  const pending = (invites.data ?? []).filter(
    (i) => i.status === "pending" && (i.expiresAt ?? Infinity) > now,
  );
  const expired = (invites.data ?? []).filter(
    (i) => i.status === "pending" && (i.expiresAt ?? Infinity) <= now,
  );

  const handleRevoke = async (inviteId: Id<"invites">) => {
    try {
      await revokeInvite({ inviteId });
      toast.success("Invitación revocada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al revocar.");
    }
  };

  const handleResend = async (inviteId: Id<"invites">) => {
    try {
      await resendInvite({ inviteId });
      toast.success("Invitación reenviada: vuelve a tener 7 días.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reenviar.");
    }
  };

  return {
    me,
    users,
    centers,
    invites,
    pending,
    expired,
    queryError,
    handleRevoke,
    handleResend,
  };
}
