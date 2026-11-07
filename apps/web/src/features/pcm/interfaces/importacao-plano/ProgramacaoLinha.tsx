import type { preverImportacaoPlano } from "../../application/prever-importacao-plano";

type Semana = ReturnType<typeof preverImportacaoPlano>[number]["conferencia"]["semanas"][number];

/** Apresenta a marcação da fonte, sem tratá-la como execução ou vencimento. */
export function ProgramacaoLinha({ semanas }: { semanas: readonly Semana[] }) {
  const marcadas = semanas.filter((semana) => semana.estado !== "sem_marcacao");
  return <details>
    <summary>{marcadas.length} marcação(ões) na planilha</summary>
    <p>As datas e códigos pertencem à fonte. X indica programação, não execução nem vencimento confirmado.</p>
    {marcadas.length === 0 ? <p>Nenhuma marcação nesta linha.</p> : <ul>{marcadas.map((semana, indice) => <li key={`${semana.codigo}:${indice}`}>
      {semana.codigo} · {semana.data || "data não informada"} · {semana.estado === "programado" ? "programado (X)" : `marcador não reconhecido: ${semana.marcadorOriginal}`}
    </li>)}</ul>}
  </details>;
}
