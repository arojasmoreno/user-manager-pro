import { BackToHome } from "@/components/BackToHome";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Ban } from "lucide-react";
import { useNavigate } from "react-router";

export function BlockedAccount() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm border border-border bg-card p-8 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
          <Ban className="size-4 text-destructive" />
        </div>
        <h1 className="font-display mt-5 text-xl font-semibold">
          Cuenta bloqueada
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Un administrador ha bloqueado esta cuenta. Si crees que es un error,
          contacta con la persona que gestiona los accesos de tu organización.
        </p>
        <Button
          variant="outline"
          className="font-ui mt-6 h-10 w-full rounded-sm"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
        >
          Cerrar sesión
        </Button>
        <BackToHome size="block" className="mt-2" />
      </div>
    </main>
  );
}
