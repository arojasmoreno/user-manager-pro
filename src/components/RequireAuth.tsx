import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

/**
 * Wraps a route that requires a signed-in user.
 *
 * Signed-out visitors see an explanation block (with their intended path
 * preserved in `/auth?returnTo=...`). Pass `redirectImmediately` for a route
 * where the bounce really is the better experience.
 */
export function RequireAuth({
  children,
  title = "Inicia sesión para continuar",
  description = "Esta página solo está disponible para usuarios con sesión iniciada.",
  redirectImmediately = false,
}: {
  children: ReactNode;
  /** Headline on the blocked screen. */
  title?: string;
  /** Says what the visitor gets by signing in. */
  description?: string;
  /** Skip the explanation and go straight to `/auth`. */
  redirectImmediately?: boolean;
}) {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    const signInHref = `/auth?returnTo=${encodeURIComponent(returnTo)}`;

    if (redirectImmediately) {
      return <Navigate to={signInHref} replace />;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm border border-border bg-card p-8 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-border bg-muted">
            <Lock className="size-4 text-muted-foreground" />
          </div>
          <h1 className="font-display mt-5 text-xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Volverás a esta página justo después de iniciar sesión.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              className="font-ui h-10 rounded-sm"
              onClick={() => navigate(signInHref)}
            >
              Iniciar sesión
            </Button>
            <Button
              variant="ghost"
              className="font-ui h-10 rounded-sm"
              onClick={() => navigate("/")}
            >
              Volver al inicio
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return children;
}
