import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import qrcode from "qrcode-generator";
import { QrCode } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Diálogo con el QR de una ficha.
 *
 * El código apunta a la ruta de visor (`/fichas/:id`), así que pegado en la
 * máquina abre directamente el documento en el móvil, sin tener que buscar en
 * el catálogo. Es la mejora que conecta el papel con la app.
 */
export function FichaQrDialog({
  fichaId,
  title,
}: {
  fichaId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  // La URL se calcula al abrir: el origen real del despliegue (producción,
  // preview o localhost), nunca un valor horneado.
  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/fichas/${fichaId}`;
  }, [fichaId, open]);

  // `qrcode-generator` dibuja en un nodo <table>; se genera en SVG para que
  // escale sin pixelarse y sea imprimible en etiquetas grandes.
  const svg = useMemo(() => {
    if (!open || !url) return "";
    try {
      const qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 0 });
    } catch {
      return "";
    }
  }, [open, url]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="font-ui h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          title="Ver código QR"
        >
          <QrCode className="size-3.5" />
          <span className="hidden sm:inline">QR</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm bg-card sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Código QR
          </DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>
        {svg ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div
              // El SVG generado es contenido fijo y local; se inyecta tal cual.
              className="rounded-sm border border-border bg-white p-3 [&>svg]:size-48"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="font-ui text-center text-[11px] leading-relaxed text-muted-foreground">
              Escanea para abrir el documento en el móvil. Imprímelo y pégalo
              junto a la máquina.
            </p>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No se ha podido generar el código QR.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
