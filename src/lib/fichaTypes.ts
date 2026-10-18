/**
 * Tipos de ficha («categorías» del catálogo documental).
 *
 * Los cuatro tipos clásicos no viven como filas en la base de datos: se
 * fusionan en cada lectura desde `DEFAULT_FICHA_TYPES`. Así una instalación que
 * ya tenía fichas con `kind: "ficha_tecnica"` sigue mostrando sus etiquetas sin
 * ninguna migración. Una fila con el mismo `slug` sobrescribe el tipo clásico
 * (permite renombrarlo o cambiarle el icono) y `hidden: true` lo retira.
 *
 * Este módulo es puro a propósito: lo importan tanto el backend de Convex como
 * la interfaz, y sus reglas se prueban sin base de datos.
 */

/** Un tipo tal y como se guarda en la tabla `fichaTypes`. */
export type FichaTypeRow = {
  slug: string;
  name: string;
  icon: string;
  /** Posición en los filtros. Los clásicos usan 10, 20, 30 y 40. */
  order: number;
  /** `true` cuando el administrador ha retirado este tipo. */
  hidden?: boolean;
};

/** Un tipo ya resuelto para pintarlo en la interfaz. */
export type FichaType = {
  slug: string;
  name: string;
  icon: string;
  order: number;
  /** `true` para los cuatro tipos que trae la aplicación de fábrica. */
  builtIn: boolean;
  /** `true` cuando el administrador ha retirado el tipo. */
  hidden: boolean;
};

/**
 * Un tipo con el número de fichas que lo usan (panel de administración).
 *
 * `id` existe cuando el valor viene de una fila de base de datos; los tipos de
 * serie puros llevan `id` como `FichaType.slug` de serie y se diferencian por
 * `slug`.
 */
export type AdminFichaType = FichaType & { fichaCount: number; id: string };

/** Alias ergonómico para el caso en que el tipo proporciona un identificador de base de datos. */
export type AdminFichaTypeWithId = AdminFichaType;

/** Los cuatro tipos de serie, con sus etiquetas y su icono. */
export const DEFAULT_FICHA_TYPES: readonly FichaTypeRow[] = [
  { slug: "ficha_tecnica", name: "Ficha técnica", icon: "file-text", order: 10 },
  {
    slug: "ficha_seguridad",
    name: "Ficha de seguridad",
    icon: "shield-alert",
    order: 20,
  },
  {
    slug: "manual_instrucciones",
    name: "Manual de máquina",
    icon: "book-open",
    order: 30,
  },
  {
    slug: "instrucciones_trabajo",
    name: "Instrucción de trabajo",
    icon: "list-checks",
    order: 40,
  },
];

export const DEFAULT_FICHA_TYPE_SLUGS: readonly string[] =
  DEFAULT_FICHA_TYPES.map((t) => t.slug);

/**
 * Iconos que un administrador puede elegir. Son claves, no componentes: el
 * cliente las traduce a iconos de lucide y el backend solo guarda la cadena.
 */
export const FICHA_ICON_KEYS = [
  "file-text",
  "shield-alert",
  "book-open",
  "list-checks",
  "wrench",
  "flask-conical",
  "hard-hat",
  "clipboard-list",
  "package",
  "zap",
] as const;

export type FichaIconKey = (typeof FICHA_ICON_KEYS)[number];

export const DEFAULT_FICHA_ICON: FichaIconKey = "file-text";

export const isFichaIcon = (value: unknown): value is FichaIconKey =>
  typeof value === "string" &&
  (FICHA_ICON_KEYS as readonly string[]).includes(value);

/** Etiquetas de los tipos de serie, para contextos sin acceso a la base. */
export const DEFAULT_KIND_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_FICHA_TYPES.map((t) => [t.slug, t.name]),
);

export const isDefaultFichaTypeSlug = (slug: string): boolean =>
  DEFAULT_FICHA_TYPE_SLUGS.includes(slug);

/**
 * Convierte el nombre visible en un identificador estable. El `slug` es la
 * identidad del tipo (es lo que guardan las fichas), así que renombrar un tipo
 * no lo cambia; solo las fichas nuevas usan identificadores nuevos.
 */
export function slugifyFichaType(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
    .replace(/_+$/g, "");
}

/** Compara nombres ignorando acentos, mayúsculas y espacios sobrantes. */
export function sameFichaTypeName(a: string, b: string): boolean {
  return (
    a
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase() ===
    b
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
  );
}

/**
 * Fusiona los tipos de serie con las filas guardadas.
 *
 * - Una fila cuyo `slug` es de serie lo sobrescribe (renombrado o icono nuevo).
 * - Las filas propias se añaden al final.
 * - Las marcadas como `hidden` desaparecen de la lista.
 */
export function mergeFichaTypes(
  rows: readonly FichaTypeRow[],
  options: { includeHidden?: boolean } = {},
): FichaType[] {
  const available = new Map<string, FichaTypeRow>();
  for (const row of rows) {
    if (!available.has(row.slug)) available.set(row.slug, row);
  }

  const builtIn: FichaType[] = DEFAULT_FICHA_TYPES.map((fallback) => {
    const row = available.get(fallback.slug);
    const source = row ?? fallback;
    return {
      slug: fallback.slug,
      name: row?.name?.trim() ? row.name.trim() : fallback.name,
      icon: isFichaIcon(source.icon) ? source.icon : fallback.icon,
      order: row?.order ?? fallback.order,
      builtIn: true,
      hidden: row?.hidden === true,
    };
  });

  const custom: FichaType[] = rows
    .filter((row) => !isDefaultFichaTypeSlug(row.slug))
    .map((row) => ({
      slug: row.slug,
      name: row.name.trim(),
      icon: isFichaIcon(row.icon) ? row.icon : DEFAULT_FICHA_ICON,
      order: row.order,
      builtIn: false,
      hidden: row.hidden === true,
    }));

  return [...builtIn, ...custom]
    .filter((type) => options.includeHidden === true || !type.hidden)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** Etiqueta legible para un `kind`, con el propio slug como último recurso. */
export function fichaTypeLabel(
  kind: string,
  types: readonly FichaType[],
): string {
  return (
    types.find((type) => type.slug === kind)?.name ??
    DEFAULT_KIND_LABELS[kind] ??
    kind
  );
}

/** Siguiente posición libre, para que un tipo nuevo quede al final. */
export function nextFichaTypeOrder(rows: readonly FichaTypeRow[]): number {
  const highest = mergeFichaTypes(rows, { includeHidden: true }).reduce(
    (max, type) => Math.max(max, type.order),
    0,
  );
  return highest + 10;
}
