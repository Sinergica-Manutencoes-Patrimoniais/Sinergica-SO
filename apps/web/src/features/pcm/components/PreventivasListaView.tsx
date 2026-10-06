import type { ItemCalendarioPreventiva } from "./PreventivasCalendarioView";

const ESTADO: Record<ItemCalendarioPreventiva["estado"], string> = {
  prevista: "Prevista",
  atrasada: "Atrasada",
  agendada: "Agendada",
  auvo_disponivel: "No Auvo",
  concluida: "Concluída",
};

function dataOperacional(ocorrencia: ItemCalendarioPreventiva): string {
  return ocorrencia.visitaEm ?? `${ocorrencia.vencimento}T00:00:00`;
}

function dataBr(valor: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(valor.includes("T") ? { timeStyle: "short" } : {}),
  }).format(new Date(valor));
}

/** Lista é a leitura inicial de triagem: data, alvo/planejamento e estado no mesmo scan. */
export function PreventivasListaView({
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
    <div className="overflow-x-auto rounded-lg border border-line">
      <div className="min-w-[640px] divide-y divide-line-soft">
        <div className="grid grid-cols-[9rem_minmax(15rem,1fr)_9rem_8rem] gap-3 bg-paper px-3 py-2 text-micro font-semibold uppercase tracking-wider text-ink-3">
          <span>Quando</span>
          <span>Plano</span>
          <span>Estado</span>
          <span className="text-right">Resultado</span>
        </div>
        {ordenadas.map((ocorrencia) => (
          <button
            key={ocorrencia.id}
            type="button"
            onClick={() => onSelecionar(ocorrencia.id)}
            aria-label={`Ver preventiva ${ocorrencia.nomePlano}`}
            className="grid w-full grid-cols-[9rem_minmax(15rem,1fr)_9rem_8rem] items-center gap-3 px-3 py-3 text-left hover:bg-orange-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange"
          >
            <span className="text-caption text-ink-2">{dataBr(dataOperacional(ocorrencia))}</span>
            <span className="min-w-0">
              <span className="block truncate text-body font-medium text-ink">
                {ocorrencia.nomePlano}
              </span>
              <span className="block text-caption text-ink-3">
                Vencimento {dataBr(ocorrencia.vencimento)}
              </span>
            </span>
            <span className="text-caption text-ink-2">{ESTADO[ocorrencia.estado]}</span>
            <span className="text-right text-caption text-ink-2">
              {ocorrencia.resultado === "nao_ok"
                ? "Não OK"
                : ocorrencia.resultado === "ok"
                  ? "OK"
                  : "Pendente"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
