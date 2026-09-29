import { motion } from "framer-motion";
import { BackToHome } from "@/components/BackToHome";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-background text-foreground"
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-sm border border-foreground/25 bg-card">
            <span className="font-display text-sm font-semibold">D</span>
          </div>
          <span className="font-ui text-sm font-medium tracking-wide">
            Doc Manager
          </span>
        </Link>
        <BackToHome />
      </header>

      <main className="flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-sm border border-border bg-card p-10 text-center">
          <p className="kicker">Error 404</p>
          <h1 className="font-display mt-3 text-3xl font-semibold">
            Página no encontrada
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            La dirección que buscas no existe o ha cambiado. Vuelve al inicio
            para seguir trabajando con tus fichas.
          </p>
          <Button asChild className="font-ui mt-6 h-10 w-full rounded-sm">
            <Link to="/">Ir a la página principal</Link>
          </Button>
          <BackToHome size="block" className="mt-2" />
        </div>
      </main>
    </motion.div>
  );
}
