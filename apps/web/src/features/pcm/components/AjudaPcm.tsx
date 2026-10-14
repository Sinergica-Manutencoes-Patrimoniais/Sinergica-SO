import { CircleHelp } from "lucide-react";

/** Link somente de leitura: mantém a tarefa atual aberta e não leva dados do cliente à URL. */
export function AjudaPcm({
  assunto,
  rotulo = "Ajuda",
}: {
  assunto:
    | "inicio"
    | "cliente-360"
    | "chamados"
    | "os"
    | "componentes"
    | "sistemas"
    | "preventivas"
    | "estrutura"
    | "auvo";
  rotulo?: string;
}) {
  return (
    <a
      href={`/?guia=pcm#pcm-${assunto}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${rotulo} (abre em outra aba)`}
      className="inline-flex items-center gap-1.5 self-start text-caption text-ink-3 hover:text-ink hover:underline"
    >
      <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      {rotulo}
    </a>
  );
}
