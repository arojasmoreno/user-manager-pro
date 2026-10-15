import type { FichaType } from "@/lib/fichaTypes";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Search box plus the type filter rail, with a count per type. */
export function FichaFilters({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  railTypes,
  countOf,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  railTypes: FichaType[];
  countOf: (slug: string) => number;
}) {
  return (
    <div className="flex flex-col gap-4 border-y border-border py-3 sm:flex-row sm:items-center">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 rounded-sm pl-9"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por título, producto o fabricante…"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {[
          { value: "all", label: "Todas" },
          ...railTypes.map((type) => ({
            value: type.slug,
            label: type.name,
          })),
        ].map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onFilterChange(value)}
            className={cn(
              "font-ui cursor-pointer text-sm transition-colors",
              filter === value
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {value !== "all" && (
              <span className="ml-1 text-xs text-muted-foreground/70">
                {countOf(value)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
