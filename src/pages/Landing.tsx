import { motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  FlaskConical,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useI18n } from "@/i18n";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

function SectionDivider() {
  return <div className="mx-auto h-px w-full max-w-5xl bg-border" />;
}

export default function Landing() {
  const { isLoading, isAuthenticated } = useAuth();
  const { t } = useI18n();

  const primaryHref = isAuthenticated ? "/dashboard" : "/auth";
  const primaryLabel = isAuthenticated
    ? t("Abrir mi espacio")
    : isLoading
      ? t("Cargando…")
      : t("Iniciar sesión");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-sm border border-foreground/25 bg-card">
            <span className="font-display text-sm font-semibold">D</span>
          </div>
          <span className="font-ui text-sm font-medium tracking-wide">
            Doc Manager
          </span>
        </div>
        <nav className="font-ui flex items-center gap-4 text-sm text-muted-foreground">
          <Link
            to={primaryHref}
            className="transition-colors hover:text-foreground"
          >
            {t(isAuthenticated ? "Mi espacio" : "Iniciar sesión")}
          </Link>
          <LanguagePicker />
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-14 pb-20 sm:pt-24">
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="kicker"
        >
          {t("Gestión de usuarios · Documentación técnica · Seguridad química")}
        </motion.p>
        <motion.h1
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-6 max-w-3xl text-4xl leading-[1.1] font-semibold sm:text-6xl"
        >
          {t("Cada centro, con su documentación.")}
          <span className="block text-muted-foreground">
            {t("Nada más, nada menos.")}
          </span>
        </motion.h1>
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
        >
          {t(
            "Doc Manager organiza fichas técnicas, fichas de seguridad, manuales e instrucciones de trabajo por centro de trabajo. Los administradores gestionan personas y permisos; cada usuario consulta exactamente la documentación de su centro.",
          )}
        </motion.p>
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <Link
            to={primaryHref}
            className="font-ui inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {primaryLabel}
            <ArrowRight className="size-4" />
          </Link>
          <p className="font-ui text-xs text-muted-foreground">
            {t("Acceso con código por correo · Sin contraseñas")}
          </p>
        </motion.div>

        {/* Thin framed plate */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-16 rounded-sm border border-border bg-card p-1.5"
        >
          <div className="grid gap-px overflow-hidden rounded-[2px] bg-border sm:grid-cols-3">
            <div className="bg-card p-8">
              <Users className="size-5 text-muted-foreground" />
              <h3 className="font-ui mt-4 text-sm font-semibold">
                Usuarios con nombre, rol y centro
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                De cada usuario se gestionan su nombre, su centro de trabajo y
                su rol. Los administradores añaden, bloquean, eliminan y
                modifican cuentas.
              </p>
            </div>
            <div className="bg-card p-8">
              <FileText className="size-5 text-muted-foreground" />
              <h3 className="font-ui mt-4 text-sm font-semibold">
                Tipos de documento a medida
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Fichas técnicas, de seguridad, manuales e instrucciones de
                trabajo, más los tipos que cree tu administrador. Siempre
                asignados a un centro.
              </p>
            </div>
            <div className="bg-card p-8">
              <ShieldCheck className="size-5 text-muted-foreground" />
              <h3 className="font-ui mt-4 text-sm font-semibold">
                Acceso restringido
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Cada usuario solo ve las fichas de sus centros. Los
                administradores ven y gestionan todo el catálogo.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      <SectionDivider />

      {/* Editorial strip */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <p className="kicker pt-1">Cómo funciona</p>
          <div className="space-y-10">
            {[
              {
                step: "01",
                title: "El administrador crea los centros de trabajo",
                body: "Cada centro se registra con nombre, código y dirección. Es el eje del catálogo: toda ficha pertenece a uno o varios centros.",
              },
              {
                step: "02",
                title: "Añade usuarios con nombre, rol y centros",
                body: "Cada persona recibe un acceso por correo. Al entrar, ya tiene su nombre, su rol y sus centros de trabajo listos.",
              },
              {
                step: "03",
                title: "Sube fichas y asígnalas a cada centro",
                body: "Pega la URL donde está colgado el documento o súbelo directamente al almacenamiento del proyecto. Queda disponible desde el catálogo.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="grid gap-3 border-t border-border pt-6 sm:grid-cols-[80px_1fr]"
              >
                <span className="font-ui text-xs tracking-widest text-muted-foreground">
                  {item.step}
                </span>
                <div>
                  <h3 className="font-display text-xl">{item.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Closing CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <FlaskConical className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-6 text-3xl font-semibold sm:text-4xl">
            Tu centro, a un paso.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Entra con tu correo y consulta la documentación de tu centro de
            trabajo.
          </p>
          <Link
            to={primaryHref}
            className="font-ui mt-8 inline-flex items-center gap-2 rounded-sm border border-foreground/25 bg-card px-6 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            {primaryLabel}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
          <span className="font-ui text-xs text-muted-foreground">
            Doc Manager · Documentación por centro de trabajo
          </span>
          <span className="font-ui text-xs text-muted-foreground">
            Versión 1
          </span>
        </div>
      </footer>
    </div>
  );
}
