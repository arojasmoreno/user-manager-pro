import type { Id } from "@/convex/_generated/dataModel";
import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export type PendingInvite = {
  _id: Id<"invites">;
  email: string;
  role: string;
};

export function PendingInvites({
  invites,
  onRevoke,
}: {
  invites: PendingInvite[];
  onRevoke: (inviteId: Id<"invites">) => void;
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
        {invites.map((inv, idx) => (
          <div
            key={inv._id}
            className={cn(
              "flex flex-col gap-2 bg-card p-4 sm:flex-row sm:items-center sm:justify-between",
              idx > 0 && "border-t border-border",
            )}
          >
            <div className="flex items-center gap-3">
              <Mail className="size-4 text-muted-foreground" />
              <span className="text-sm">{inv.email}</span>
              <Badge
                variant="outline"
                className="font-ui rounded-sm text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                {inv.role === ROLES.ADMIN ? "Administrador" : "Usuario"}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="font-ui h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => onRevoke(inv._id)}
            >
              Revocar
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
