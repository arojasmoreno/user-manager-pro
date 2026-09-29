import { BlockedAccount } from "@/components/BlockedAccount";
import { FichasSection } from "@/components/FichasSection";
import { AsistenteSection } from "@/components/AsistenteSection";
import { CentrosSection } from "@/components/CentrosSection";
import { UsuariosSection } from "@/components/UsuariosSection";
import {
  WorkspaceShell,
  type WorkspaceTab,
} from "@/components/WorkspaceShell";
import { ROLES } from "@/lib/roles";
import { ASSISTANT_ENABLED } from "@/lib/features";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

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
      {activeTab === "fichas" && <FichasSection />}
      {ASSISTANT_ENABLED && activeTab === "asistente" && <AsistenteSection />}
      {isAdmin && activeTab === "centros" && <CentrosSection />}
      {isAdmin && activeTab === "usuarios" && <UsuariosSection />}
    </WorkspaceShell>
  );
}
