import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockedAccount } from "@/components/BlockedAccount";
import { FichasSection } from "@/components/FichasSection";
import { CentrosSection } from "@/components/CentrosSection";
import { UsuariosSection } from "@/components/UsuariosSection";
import {
  WorkspaceShell,
  type WorkspaceTab,
} from "@/components/WorkspaceShell";
import { ROLES } from "@/lib/roles";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

function BootstrapPromoDialog() {
  const me = useQuery(api.users.currentUser, {});
  const claim = useMutation(api.access.consumeBootstrapPromo);
  const [claiming, setClaiming] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Derived, not synced with an effect: the dialog only applies while the
  // current user still has no role assigned.
  const eligible = !!me && me.role === undefined;
  if (!eligible) return null;
  const show = !dismissed;

  const accept = async () => {
    setClaiming(true);
    try {
      const ok = await claim({});
      if (!ok) {
        toast.info("La cuenta administradora principal ya fue asignada.");
      }
    } finally {
      setClaiming(false);
      setDismissed(true);
    }
  };

  return (
    <Dialog
      open={show}
      onOpenChange={(o) => {
        if (!o) {
          setDismissed(true);
        }
      }}
    >
      <DialogContent className="rounded-sm bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Primera cuenta de la organización
          </DialogTitle>
          <DialogDescription>
            Esta es la primera cuenta en entrar. Puedes convertirla en la
            cuenta administradora principal de Doc Manager.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            className="font-ui rounded-sm"
            onClick={() => setDismissed(true)}
            disabled={claiming}
          >
            No, gracias
          </Button>
          <Button
            className="font-ui rounded-sm"
            onClick={accept}
            disabled={claiming}
          >
            Ser administrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;
  const [tab, setTab] = useState<WorkspaceTab>("fichas");

  // Non-admins only ever see Fichas, so clamp the tab during render instead of
  // syncing it back with an effect.
  const activeTab: WorkspaceTab = isAdmin ? tab : "fichas";

  // Administrators can block accounts; blocked users see this screen instead
  // of the workspace.
  if (user?.blocked === true) {
    return <BlockedAccount />;
  }

  return (
    <WorkspaceShell tab={activeTab} onTabChange={setTab}>
      <BootstrapPromoDialog />
      {activeTab === "fichas" && <FichasSection />}
      {isAdmin && activeTab === "centros" && <CentrosSection />}
      {isAdmin && activeTab === "usuarios" && <UsuariosSection />}
    </WorkspaceShell>
  );
}
