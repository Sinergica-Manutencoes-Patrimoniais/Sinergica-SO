import type { ResumoChamadoCard } from "../domain/progresso-chamado";

export function ProgressoChamadoCard({ resumo }: { resumo: ResumoChamadoCard | null }) {
  if (!resumo) return null;
  return (
    <p className="mt-1 text-micro text-ink-3">
      {resumo.finalizadas} de {resumo.total} OS finalizadas
      {resumo.etapasMistas && " · Em andamento"}
    </p>
  );
}
