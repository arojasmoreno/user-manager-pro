import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  CornerDownLeft,
  ExternalLink,
  Loader2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useRef, useState } from "react";

type Source = {
  _id: string;
  title: string;
  kind: string;
  url: string;
  centerNames: string[];
};

type Turn = {
  id: number;
  question: string;
  answer?: string;
  sources?: Source[];
  error?: string;
  pending?: boolean;
};

const KIND_LABELS: Record<string, string> = {
  ficha_tecnica: "Ficha técnica",
  ficha_seguridad: "Ficha de seguridad",
  manual_instrucciones: "Manual de máquina",
  instrucciones_trabajo: "Instrucción de trabajo",
};

const SUGGESTIONS = [
  "¿Qué fichas hay sobre productos de limpieza?",
  "¿Qué documentación existe para el centro Montornes?",
  "¿Tengo algún manual de máquina?",
];

export function AsistenteSection() {
  const ask = useAction(api.ai.askFichaQuestion);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;

    const id = nextId.current++;
    setTurns((prev) => [
      ...prev,
      { id, question: clean, pending: true },
    ]);
    setQuestion("");
    setBusy(true);
    try {
      const result = await ask({ question: clean });
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                id,
                question: t.question,
                answer: result.answer,
                sources: result.sources,
              }
            : t,
        ),
      );
    } catch (err) {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                id,
                question: t.question,
                error:
                  err instanceof Error
                    ? err.message
                    : "No se ha podido consultar al asistente.",
              }
            : t,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="kicker">Asistente documental</p>
        <h2 className="font-display mt-2 text-3xl font-semibold">
          Pregunta sobre las fichas
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Escribe una pregunta y el asistente busca en el catálogo de fichas al
          que tienes acceso y responde con la información disponible.
        </p>
      </div>

      <div className="overflow-hidden rounded-sm border border-border bg-card">
        {/* Conversación */}
        <div className="max-h-[28rem] space-y-6 overflow-y-auto p-6">
          {turns.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-full border border-border bg-muted">
                <Sparkles className="size-4 text-muted-foreground" />
              </div>
              <p className="font-display mt-4 text-lg">
                ¿Sobre qué quieres saber?
              </p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                El asistente responde con la información del catálogo: tipo de
                ficha, producto, fabricante, centros y enlace al documento.
              </p>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className="space-y-4">
                <div className="flex justify-end">
                  <p className="max-w-md rounded-sm bg-foreground px-4 py-2 text-sm text-background">
                    {turn.question}
                  </p>
                </div>
                <div className="max-w-2xl space-y-3">
                  {turn.pending && (
                    <p className="font-ui flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Buscando en el catálogo…
                    </p>
                  )}
                  {turn.error && (
                    <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4">
                      <p className="font-ui text-xs uppercase tracking-wider text-destructive">
                        No se ha podido responder
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {turn.error}
                      </p>
                    </div>
                  )}
                  {turn.answer && (
                    <>
                      <p className="text-sm leading-relaxed whitespace-pre-line">
                        {turn.answer}
                      </p>
                      {turn.sources && turn.sources.length > 0 && (
                        <div className="space-y-2">
                          <p className="kicker">Fichas usadas</p>
                          {turn.sources.map((s) => (
                            <a
                              key={s._id}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background px-3 py-2 transition-colors hover:border-foreground/30"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {s.title}
                                </span>
                                <span className="font-ui text-[11px] text-muted-foreground">
                                  {KIND_LABELS[s.kind] ?? s.kind}
                                  {s.centerNames.length > 0
                                    ? ` · ${s.centerNames.join(", ")}`
                                    : ""}
                                </span>
                              </span>
                              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sugerencias */}
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border px-6 py-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="font-ui rounded-sm border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          className="flex items-center gap-2 border-t border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(question);
          }}
        >
          <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Escribe tu pregunta sobre las fichas…"
            className="h-10 rounded-sm border-0 shadow-none focus-visible:ring-0"
            disabled={busy}
          />
          <Button
            type="submit"
            className="font-ui h-10 shrink-0 gap-2 rounded-sm"
            disabled={busy || question.trim().length === 0}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CornerDownLeft className="size-3.5" />
            )}
            <span className="hidden sm:inline">Preguntar</span>
          </Button>
        </form>
      </div>

      <p className="font-ui flex items-start gap-2 text-xs text-muted-foreground">
        <BookOpen className="mt-0.5 size-3.5 shrink-0" />
        El asistente solo responde con la información guardada en el catálogo
        (título, tipo, producto, fabricante, centros y enlace). No inventa datos
        y, si no encuentra la respuesta, te lo dirá.
      </p>
      <Badge
        variant="outline"
        className="font-ui rounded-sm border-border text-[11px] uppercase tracking-wider text-muted-foreground"
      >
        Solo fichas de tus centros
      </Badge>
    </div>
  );
}
