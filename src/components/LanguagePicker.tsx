import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FlagIcon } from "@/components/FlagIcon";
import { useI18n } from "@/i18n";
import { LOCALES, getLocale } from "@/i18n/locales";
import { cn } from "@/lib/utils";

/**
 * Language switcher. The trigger shows the flag of the active country, and the
 * menu lists every supported locale with its own flag.
 */
export function LanguagePicker({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const active = getLocale(locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("Idioma")}
          title={`${active.name} — ${t("Idioma")}`}
          className={cn("font-ui h-8 gap-2", className)}
        >
          <FlagIcon country={active.country} className="h-3 w-4" />
          <span className="hidden text-xs sm:inline">{active.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-sm bg-card">
        {LOCALES.map((item) => (
          <DropdownMenuItem
            key={item.code}
            onSelect={() => setLocale(item.code)}
            className={cn(
              "font-ui gap-3",
              item.code === locale && "bg-primary text-primary-foreground",
            )}
          >
            <FlagIcon country={item.country} />
            <span className="text-sm">{item.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
