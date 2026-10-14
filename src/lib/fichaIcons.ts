import {
  BookOpen,
  ClipboardList,
  FileText,
  FlaskConical,
  HardHat,
  ListChecks,
  Package,
  ShieldAlert,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { DEFAULT_FICHA_ICON, type FichaIconKey } from "./fichaTypes";

/**
 * Traducción de la clave de icono guardada en `fichaTypes` al icono real.
 *
 * Vive aparte de `fichaTypes.ts` porque importa componentes de lucide: el
 * backend de Convex comparte el módulo puro y nunca debe cargar iconos.
 */
const ICONS: Record<FichaIconKey, LucideIcon> = {
  "file-text": FileText,
  "shield-alert": ShieldAlert,
  "book-open": BookOpen,
  "list-checks": ListChecks,
  wrench: Wrench,
  "flask-conical": FlaskConical,
  "hard-hat": HardHat,
  "clipboard-list": ClipboardList,
  package: Package,
  zap: Zap,
};

/** Icono de un tipo; si la clave es desconocida cae al documento genérico. */
export const fichaIcon = (key: string): LucideIcon =>
  ICONS[key as FichaIconKey] ?? ICONS[DEFAULT_FICHA_ICON];

/**
 * Clases del marco del icono. Los documentos de seguridad se destacan en rojo
 * para que un operario los reconozca de un vistazo.
 */
export const fichaIconTone = (key: string): string =>
  key === "shield-alert"
    ? "border-destructive/30 text-destructive"
    : "border-border text-muted-foreground";

/** Opciones del selector de icono, en el orden en que se pintan. */
export const FICHA_ICON_OPTIONS: { key: FichaIconKey; label: string }[] = [
  { key: "file-text", label: "Documento" },
  { key: "shield-alert", label: "Seguridad" },
  { key: "book-open", label: "Manual" },
  { key: "list-checks", label: "Lista" },
  { key: "clipboard-list", label: "Procedimiento" },
  { key: "wrench", label: "Herramienta" },
  { key: "flask-conical", label: "Producto químico" },
  { key: "hard-hat", label: "Equipo de protección" },
  { key: "package", label: "Material" },
  { key: "zap", label: "Energía" },
];
