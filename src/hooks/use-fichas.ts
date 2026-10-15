import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useFichaTranslations } from "@/hooks/use-ficha-translations";
import { useSafeQuery } from "@/hooks/use-safe-query";
import {
  DEFAULT_FICHA_ICON,
  fichaTypeLabel,
  mergeFichaTypes,
  type FichaType,
} from "@/lib/fichaTypes";
import { ROLES } from "@/lib/roles";
import { useMemo } from "react";

/**
 * Datos del catálogo de fichas.
 *
 * Concentra las consultas y las listas derivadas (tipos visibles, tipos del
 * filtro, centros y traducciones) para que la vista sólo se ocupe de pintar.
 *
 * IMPORTANTE: el orden de las consultas está fijado (listMine, listAll,
 * listCenters, listMyCenters, listTypes, listTypesAdmin y, al final, las
 * traducciones). `src/test/tabs.test.tsx` sustituye las consultas por una cola
 * en ese orden; no reordenar sin actualizar el test.
 */
export function useFichasCatalog() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  const fichas = useSafeQuery(api.fichas.listMine);
  const adminFichas = useSafeQuery(api.fichas.listAll, isAdmin ? {} : "skip");
  const adminCenters = useSafeQuery(api.access.listCenters, isAdmin ? {} : "skip");
  const myCentersData = useSafeQuery(
    api.access.listMyCenters,
    isAdmin ? "skip" : {},
  );
  // El catálogo trae los tipos visibles; el administrador usa además el panel
  // de gestión, que sí incluye los retirados y cuántas fichas usa cada uno.
  const publicTypes = useSafeQuery(
    api.fichaTypes.listTypes,
    isAdmin ? "skip" : {},
  );
  const adminTypes = useSafeQuery(
    api.fichaTypes.listTypesAdmin,
    isAdmin ? {} : "skip",
  );
  // Las fichas se muestran en el idioma activo; lo que no esté traducido se ve
  // tal y como lo escribió el administrador, en español.
  const translateFicha = useFichaTranslations();

  const myCenters = isAdmin ? (adminCenters.data ?? []) : (myCentersData.data ?? []);

  const queryError =
    fichas.error ??
    adminFichas.error ??
    adminCenters.error ??
    myCentersData.error ??
    null;

  const list = isAdmin ? (adminFichas.data ?? fichas.data) : fichas.data;

  const centerNames = (ids: string[]) =>
    ids
      .map((id) => myCenters.find((c) => c._id === id)?.name)
      .filter(Boolean) as string[];

  // Mientras carga la consulta se usan los cuatro tipos de serie, de modo que
  // el catálogo nunca se pinte con slugs en crudo.
  const types: FichaType[] = useMemo(() => {
    if (!isAdmin) return publicTypes.data ?? mergeFichaTypes([]);
    const loaded = adminTypes.data;
    return loaded
      ? loaded.filter((type) => !type.hidden)
      : mergeFichaTypes([]);
  }, [isAdmin, publicTypes.data, adminTypes.data]);

  /**
   * Tipos del filtro: los declarados más cualquier tipo que aparezca en una
   * ficha sin estar en la lista. Así ninguna ficha queda fuera de los filtros
   * por culpa de un catálogo antiguo.
   */
  const railTypes: FichaType[] = useMemo(() => {
    const known = new Set(types.map((type) => type.slug));
    const orphans = [...new Set((list ?? []).map((f) => f.kind))]
      .filter((kind) => !known.has(kind))
      .map((slug) => ({
        slug,
        name: fichaTypeLabel(slug, types),
        icon: DEFAULT_FICHA_ICON,
        order: Number.MAX_SAFE_INTEGER,
        builtIn: false,
        hidden: false,
      }));
    return [...types, ...orphans];
  }, [types, list]);

  return {
    isAdmin,
    list,
    types,
    // Tipos del panel de gestión (incluye los retirados y el recuento de uso).
    adminTypes: adminTypes.data ?? [],
    railTypes,
    myCenters,
    centerNames,
    translateFicha,
    queryError,
  };
}
