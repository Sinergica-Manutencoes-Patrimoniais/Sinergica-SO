import type { ItemCalendarioPreventiva } from "./PreventivasCalendarioView";

function dataOperacional(ocorrencia: ItemCalendarioPreventiva): string {
  return ocorrencia.visitaEm ?? `${ocorrencia.vencimento}T00:00:00`;
}

function dataBr(valor: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    ...(valor.includes("T") ? { timeStyle: "short" } : {}),
  }).format(new Date(valor));
}

function rotuloEstado(estado: ItemCalendarioPreventiva["estado"]): string {
  if (estado === "atrasada") return "Atrasada";
  if (estado === "agendada") return "Visita agendada";
  if (estado === "auvo_disponivel") return "Disponível no Auvo";
  if (estado === "concluida") return "Concluída";
  return "Vencimento previsto";
}

/** Linha temporal para leitura de sequência: previsto, visita e execução no mesmo eixo. */
export function PreventivasTimelineView({
  ocorrencias,
  onSelecionar,
}: {
  ocorrencias: readonly ItemCalendarioPreventiva[];
  onSelecionar: (ocorrenciaId: string) => void;
}) {
  const ordenadas = [...ocorrencias].sort((a, b) =>
    dataOperacional(a).localeCompare(dataOperacional(b)),
  );

  if (ordenadas.length === 0)
    return <p className="text-body text-ink-3">Nenhuma ocorrência planejada.</p>;

  return (
    <ol className="ml-3 border-l-2 border-line pl-5">
      {ordenadas.map((ocorrencia) => (
        <li key={ocorrencia.id} className="relative pb-5 last:pb-0">
          <span className="absolute -left-[1.85rem] top-3 h-3 w-3 rounded-full border-2 border-card bg-orange" />
          <button
            type="button"
            onClick={() => onSelecionar(ocorrencia.id)}
            aria-label={`Ver preventiva ${ocorrencia.nomePlano}`}
            className="w-full rounded-lg border border-line bg-card px-3 py-3 text-left hover:border-orange hover:bg-orange-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange"
          >
            <span className="block text-caption text-ink-3">
              {dataBr(dataOperacional(ocorrencia))}
            </span>
            <span className="mt-1 block text-body font-medium text-ink">
              {ocorrencia.nomePlano}
            </span>
            <span className="mt-1 block text-caption text-ink-2">
              {rotuloEstado(ocorrencia.estado)} · Vencimento {dataBr(ocorrencia.vencimento)}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
