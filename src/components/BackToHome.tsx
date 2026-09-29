import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Volver al inicio" control shown on every screen.
 *
 * `size="button"` is the inline header variant; `size="block"` is the
 * standalone variant for full-page notices.
 */
export function BackToHome({
  size = "button",
  className,
}: {
  size?: "button" | "block";
  className?: string;
}) {
  return (
    <Link
      to="/"
      aria-label="Volver al inicio"
      title="Volver al inicio"
      className={cn(
        "font-ui inline-flex items-center gap-2 rounded-sm transition-colors",
        size === "button"
          ? "px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          : "h-10 w-full justify-center border border-border bg-card text-sm font-medium text-foreground hover:bg-accent",
        className,
      )}
    >
      <ArrowLeft className="size-3.5" />
      <span className={size === "button" ? "hidden sm:inline" : undefined}>
        Volver al inicio
      </span>
    </Link>
  );
}
