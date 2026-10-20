import type { Id } from "@/convex/_generated/dataModel";
import { ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Mail, RotateCcw, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export type PendingInvite = {
  _id: Id<"invites">;
  email: string;
  role: string;
  /** Momento (ms) en que caduca; opcional por si la fila es antigua. */
  expiresAt?: number;
};

/** Días (redondeados hacia arriba) que quedan de vida de la invitación. */
function daysLeft(expiresAt?: number): number | null {
  if (!expiresAt) return null;
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 86_400_000));
}

export function PendingInvites({
  invites,
  onRevoke,
  onResend,
}: {
  invites: PendingInvite[];
  onRevoke: (inviteId: Id<"invites">) => void;
  /** Renueva la invitación otros 7 días desde hoy. */
  onResend: (inviteId: Id<"invites">) => void;
}) {
  if (invites.length === 0) return null;

  return (
    <section>
      <h3 className="font-ui flex items-center gap-2 text-sm font-medium">
        <Mail className="size-4 text-muted-foreground" />
        Invitaciones pendientes
        <span className="text-muted-foreground">({invites.length})</span>
      </h3>
      <div className="mt-3 overflow-hidden rounded-sm border border-border">
        {invites.map((inv, idx) => {
          const first = inv.email.split("@")[0];
          const left = daysLeft(inv.expiresAt);
          return (
            <div
              key={inv._id}
              className={cn(
                "flex flex-col gap-2 bg-card p-4 sm:flex-row sm:items-center sm:justify-between",
                idx > 0 && "border-t border-border",
              )}
            >
              <div className="flex items-center gap-3">
                <Mail className="size-4 text-muted-foreground" />
                <a
                  href={`mailto:${inv.email}`}
                  className="inline-flex items-center justify-center border px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden [a&]:hover:bg-accent [a&]:hover:text-accent-foreground font-ui rounded-sm text-[10px] uppercase tracking-wider text-muted-foreground"
                  data-slot="badge"
                >
                  {first}
                </a>
                <span className="text-xs color-muted-foreground">
                  {inv.role === ROLES.ADMIN ? "Administrador" : "Usuario"}
                </span>
                {left !== null && (
                  <span className="font-ui inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Timer className="size-3" />
                    {left} {left === 1 ? "día" : "días"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-ui h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onResend(inv._id)}
                  title="Renovar la invitación otros 7 días"
                >
                  <RotateCcw className="size-3.5" />
                  <span className="hidden sm:inline">Reenviar</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-ui h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => onRevoke(inv._id)}
                >
                  Revocar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
