import { BackToHome } from "@/components/BackToHome";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

/**
 * Error screen shown wherever data could not be loaded or an operation failed
 * at the page level. Always offers a way back to the home page.
 */
export function ErrorState({
  title = "No se ha podido cargar esta pantalla",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="border border-border bg-card p-10 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
        <TriangleAlert className="size-4 text-destructive" />
      </div>
      <p className="kicker mt-5">Error</p>
      <h2 className="font-display mt-2 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {message ??
          "Ha ocurrido un problema al cargar la información. Vuelve al inicio e inténtalo de nuevo."}
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          className="font-ui h-10 rounded-sm"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </Button>
        <BackToHome size="block" className="sm:w-auto" />
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-ui mt-4 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Recargar los datos
        </button>
      )}
    </div>
  );
}
