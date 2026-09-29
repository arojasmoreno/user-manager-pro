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
import { useEffect, useState } from "react";
import { toast } from "sonner";

function BootstrapPromoDialog() {
  const me = useQuery(api.users.currentUser, {});
  const claim = useMutation(api.access.consumeBootstrapPromo);
  const [show, setShow] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (me && me.role === undefined && !dismissed) {
      setShow(true);
    }
    if (me && me.role !== undefined) {
      setShow(false);
    }
  }, [me, dismissed]);

  if (!me || me.role !== undefined) return null;

  const accept = async () => {
    setClaiming(true);
    try {
      const ok = await claim({});
      if (!ok) {
        toast.info("La cuenta administradora principal ya fue asignada.");
      }
    } finally {
      setClaiming(false);
      setShow(false);
    }
  };

  return (
    <Dialog
      open={show}
      onOpenChange={(o) => {
        if (!o) {
          setDismissed(true);
          setShow(false);
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
            cuenta administradora principal de Vadeos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            className="font-ui rounded-sm"
            onClick={() => {
              setDismissed(true);
              setShow(false);
            }}
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

  // Non-admins only ever see Fichas; if the tab somehow changes, snap back.
  useEffect(() => {
    if (!isAdmin && tab !== "fichas") {
      setTab("fichas");
    }
  }, [isAdmin, tab]);

  return (
    <WorkspaceShell tab={tab} onTabChange={setTab}>
      <BootstrapPromoDialog />
      {tab === "fichas" && <FichasSection />}
      {isAdmin && tab === "centros" && <CentrosSection />}
      {isAdmin && tab === "usuarios" && <UsuariosSection />}
    </WorkspaceShell>
  );
}
