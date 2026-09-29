import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackToHome } from "@/components/BackToHome";
import { LanguagePicker } from "@/components/LanguagePicker";
import { SupportDialog } from "@/components/SupportDialog";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";
import { ROLES } from "@/lib/roles";
import { ASSISTANT_ENABLED } from "@/lib/features";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";

export type WorkspaceTab = "fichas" | "asistente" | "centros" | "usuarios";

export function WorkspaceShell({
  tab,
  onTabChange,
  children,
}: {
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  children: React.ReactNode;
}) {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const isAdmin = user?.role === ROLES.ADMIN;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const tabs: { id: WorkspaceTab; label: string; adminOnly?: boolean }[] = [
    { id: "fichas", label: "Fichas" },
    ...(ASSISTANT_ENABLED
      ? [{ id: "asistente" as const, label: "Asistente" }]
      : []),
    { id: "centros", label: "Centros", adminOnly: true },
    { id: "usuarios", label: "Usuarios", adminOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-sm border border-foreground/25 bg-card">
              <span className="font-display text-sm font-semibold">D</span>
            </div>
            <div className="leading-tight">
              <p className="font-ui text-sm font-medium">Doc Manager</p>
              <p className="font-ui text-[11px] text-muted-foreground">
                {user?.name || user?.email || "Mi espacio"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BackToHome />
            <LanguagePicker />
            <SupportDialog />
            <Badge
              variant="outline"
              className="font-ui rounded-sm border-border text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t(isAdmin ? "Administrador" : "Usuario")}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="font-ui gap-2 text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="size-3.5" />
              {t("Salir")}
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-6">
          <nav className="flex gap-6">
            {visibleTabs.map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => onTabChange(tabItem.id)}
                className={cn(
                  "font-ui -mb-px border-b-2 pb-3 pt-1 text-sm transition-colors",
                  tab === tabItem.id
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(tabItem.label)}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
