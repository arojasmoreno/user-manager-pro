import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FICHAS_BUCKET, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

/** Shared source-of-document control: upload to Supabase or paste a URL. */
export function DocumentSource({
  url,
  onUrlChange,
}: {
  url: string;
  onUrlChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!supabase) {
      toast.error(
        "La subida de archivos necesita las claves de Supabase. Añádelas en la pestaña Keys o pega una URL.",
      );
      return;
    }
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage
        .from(FICHAS_BUCKET)
        .upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from(FICHAS_BUCKET).getPublicUrl(path);
      onUrlChange(data.publicUrl);
      toast.success("Documento subido. Recuerda guardar la ficha.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `No se pudo subir: ${err.message}`
          : "No se pudo subir el archivo.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Label className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
        Documento
      </Label>
      <div className="flex gap-2">
        <Input
          className="rounded-sm"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://… o sube un PDF"
          type="url"
        />
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="font-ui shrink-0 rounded-sm"
          disabled={uploading || !isSupabaseConfigured}
          title={
            isSupabaseConfigured
              ? "Subir archivo"
              : "Configura Supabase en la pestaña Keys para subir archivos"
          }
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
        </Button>
      </div>
      <p className="font-ui text-[11px] leading-relaxed text-muted-foreground">
        {isSupabaseConfigured
          ? "Pega un enlace o sube el documento; se guardará en el almacenamiento del proyecto."
          : "Subida de archivos disponible al añadir las claves de Supabase. Puedes pegar una URL mientras tanto."}
      </p>
    </div>
  );
}
