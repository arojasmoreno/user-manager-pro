import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ROLES } from "@/lib/roles";
import { BlockButton } from "@/components/usuarios/BlockButton";
import { DeleteUserButton } from "@/components/usuarios/DeleteUserButton";
import {
  EditUserDialog,
  type UserRow,
} from "@/components/usuarios/EditUserDialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type CenterDoc = Doc<"workCenters">;

export function UserRowItem({
  user,
  meId,
  centers,
  first,
}: {
  user: UserRow;
  meId: Id<"users"> | undefined;
  centers: CenterDoc[];
  first: boolean;
}) {
  const isSelf = meId === user._id;
  const isBlocked = user.blocked === true;
  const assigned = (user.workCenterIds ?? [])
    .map((id) => centers.find((c) => c._id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <div
      className={cn(
        "flex flex-col gap-3 bg-card p-4 sm:flex-row sm:items-center sm:justify-between",
        !first && "border-t border-border",
        isBlocked && "bg-muted/40",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground">
          {user.role === ROLES.ADMIN ? (
            <ShieldCheck className="size-4" />
          ) : (
            <UserRound className="size-4" />
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                isBlocked && "line-through decoration-muted-foreground/50",
              )}
            >
              {user.name || user.email || "Sin nombre"}
            </span>
            <Badge
              variant="outline"
              className="font-ui rounded-sm text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {user.role === ROLES.ADMIN ? "Administrador" : "Usuario"}
            </Badge>
            {isBlocked && (
              <Badge
                variant="outline"
                className="font-ui rounded-sm border-destructive/40 text-[10px] uppercase tracking-wider text-destructive"
              >
                Bloqueado
              </Badge>
            )}
            {isSelf && (
              <span className="font-ui text-[11px] text-muted-foreground">
                (tú)
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {user.email ?? "—"}
            {assigned.length > 0 && ` · ${assigned.join(", ")}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <EditUserDialog target={user} centers={centers} isSelf={isSelf} />
        <BlockButton target={user} isSelf={isSelf} />
        {!isSelf && <DeleteUserButton target={user} />}
      </div>
    </div>
  );
}
