import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LifeBuoy } from "lucide-react";
import { useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * In-app support request. It opens a conversation in the Help Scout inbox,
 * linked to the signed-in account, so support answers in one place instead of
 * by scattered emails.
 */
export function SupportDialog() {
  const send = useAction(api.helpscout.sendSupportRequest);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (subject.trim() === "" || body.trim() === "") {
      toast.error("Escribe un asunto y un mensaje antes de enviar.");
      return;
    }
    setBusy(true);
    try {
      await send({ subject, body });
      setSubject("");
      setBody("");
      setOpen(false);
      toast.success("Solicitud enviada. Te responderemos por correo.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo enviar la solicitud. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSubject("");
          setBody("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-ui gap-2">
          <LifeBuoy className="size-3.5" />
          Soporte
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Soporte</DialogTitle>
          <DialogDescription>
            Cuéntanos qué pasa y te respondemos por correo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-2">
            <Label
              htmlFor="support-subject"
              className="font-ui text-xs uppercase tracking-wider text-muted-foreground"
            >
              Asunto
            </Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="La ficha de Hypofoam no se descarga"
              disabled={busy}
              maxLength={120}
            />
          </div>
          <div className="grid gap-2">
            <Label
              htmlFor="support-body"
              className="font-ui text-xs uppercase tracking-wider text-muted-foreground"
            >
              Mensaje
            </Label>
            <Textarea
              id="support-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Cuéntanos con detalle qué necesitas."
              disabled={busy}
              maxLength={4000}
              className="min-h-32"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="font-ui"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" className="font-ui" disabled={busy}>
              {busy ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
