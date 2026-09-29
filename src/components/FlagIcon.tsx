import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/locales";

/**
 * Flags drawn as hard-edged SVG rectangles so they stay crisp at any size.
 * Emoji flags are not used on purpose: most Windows browsers do not render
 * them and would show the country code instead.
 */
const FLAGS: Record<string, ReactElement> = {
  ES: (
    <>
      <rect width="21" height="5" fill="#c60b1e" />
      <rect y="5" width="21" height="5" fill="#ffc400" />
      <rect y="10" width="21" height="5" fill="#c60b1e" />
    </>
  ),
  FR: (
    <>
      <rect width="7" height="15" fill="#0055a4" />
      <rect x="7" width="7" height="15" fill="#ffffff" />
      <rect x="14" width="7" height="15" fill="#ef4135" />
    </>
  ),
  GB: (
    <>
      <rect width="21" height="15" fill="#012169" />
      <path d="M0 0 21 15M21 0 0 15" stroke="#ffffff" strokeWidth="4" />
      <path d="M0 0 21 15M21 0 0 15" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M10.5 0v15M0 7.5h21" stroke="#ffffff" strokeWidth="5" />
      <path d="M10.5 0v15M0 7.5h21" stroke="#c8102e" strokeWidth="2.6" />
    </>
  ),
  MA: (
    <>
      <rect width="21" height="15" fill="#c1272d" />
      <polygon
        fill="#006233"
        points="10.5,3.5 11.5,6.1 14.3,6.3 12.1,8 12.9,10.7 10.5,9.2 8.1,10.7 8.9,8 6.7,6.3 9.5,6.1"
        stroke="#006233"
        strokeWidth="0.9"
      />
    </>
  ),
  GM: (
    <>
      <rect width="21" height="5" fill="#cc0000" />
      <rect y="5" width="21" height="1" fill="#ffffff" />
      <rect y="6" width="21" height="3" fill="#003580" />
      <rect y="9" width="21" height="1" fill="#ffffff" />
      <rect y="10" width="21" height="5" fill="#009639" />
    </>
  ),
};

export function FlagIcon({
  country,
  className,
}: {
  country: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 21 15"
      role="img"
      aria-label={country}
      shapeRendering="crispEdges"
      className={cn(
        "h-3.5 w-5 shrink-0 border border-foreground/40",
        className,
      )}
    >
      {FLAGS[country]}
    </svg>
  );
}

export function LocaleFlag({ locale, className }: { locale: Locale; className?: string }) {
  return <FlagIcon country={locale === "mnk" ? "GM" : locale.split("-")[1]} className={className} />;
}
