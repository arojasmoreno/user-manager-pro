import { ErrorState } from "@/components/ErrorState";
import { InviteDialog } from "@/components/usuarios/InviteDialog";
import { PendingInvites } from "@/components/usuarios/PendingInvites";
import { UserRowItem } from "@/components/usuarios/UserRowItem";
import type { UserRow } from "@/components/usuarios/EditUserDialog";
import { useUsuariosData } from "@/hooks/use-usuarios";
import { Button } from "@/components/ui/button";
import { Users, MapPin, RotateCcw, Timer } from "lucide-react";

export function UsuariosSection() {
  const {
    me,
    users,
    centers,
    pending,
    expired,
    queryError,
    handleRevoke,
    handleResend,
  } = useUsuariosData();

  if (queryError) {
    return <ErrorState message={queryError.message} />;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">Personas</p>
          <h2 className="font-display mt-2 text-3xl font-semibold">Usuarios</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Añade usuarios con su nombre, rol y centros. Bloquea o elimina
            cuentas cuando haga falta.
          </p>
        </div>
        <InviteDialog centers={centers.data ?? []} />
      </div>

      <PendingInvites
        invites={pending}
        onRevoke={handleRevoke}
        onResend={handleResend}
      />

      {expired.length > 0 && (
        <section>
          <h3 className="font-ui flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Timer className="size-4" />
            Caducadas
            <span>({expired.length})</span>
          </h3>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
            Estas invitaciones ya no permiten entrar. Pulsa «Reenviar» para
            darles otros 7 días.
          </p>
          <div className="mt-3 overflow-hidden rounded-sm border border-border">
            {expired.map((inv, idx) => (
              <div
                key={inv._id}
                className={`flex flex-col gap-2 bg-card p-4 sm:flex-row sm:items-center sm:justify-between ${
                  idx > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="text-sm text-muted-foreground">
                  {inv.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-ui h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleResend(inv._id)}
                >
                  <RotateCcw className="size-3.5" />
                  Reenviar
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <div className="space-y-2 border-b border-border pb-4">
          <div className="flex items-center gap-2 text-xs font-ui text-muted-foreground">
            <MapPin className="size-3.5" />
            Invitaciones pendientes ({pending.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {pending.map((invite) => (
              <span
                key={invite._id}
                className="rounded-sm bg-primary/10 px-2.5 py-1 text-xs font-ui text-primary"
              >
                {invite.email}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Users table */}
      <section>
        <h3 className="font-ui flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-muted-foreground" />
          Cuentas
          <span className="text-muted-foreground">
            ({(users.data ?? []).length})
          </span>
        </h3>

        {!users.data ? (
          <div className="mt-3 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-sm bg-muted" />
            ))}
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-sm border border-border">
            {users.data.map((u, idx) => (
              <UserRowItem
                key={u._id}
                user={u as UserRow}
                meId={me.data?._id}
                centers={centers.data ?? []}
                first={idx === 0}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
