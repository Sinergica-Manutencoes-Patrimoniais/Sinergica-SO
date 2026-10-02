import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { formatarDiaIso, gerarDiasDoMes } from "../domain/ordens-servico";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_OCORRENCIAS_POR_DIA = 3;

export type ItemCalendarioPreventiva = {
  id: string;
  nomePlano: string;
  vencimento: string;
  visitaEm: string | null;
  estado: "prevista" | "atrasada" | "agendada" | "auvo_disponivel" | "concluida";
};

const ESTADO: Record<ItemCalendarioPreventiva["estado"], { rotulo: string; classe: string }> = {
  prevista: {
    rotulo: "Prevista",
    classe: "bg-line-soft text-ink-2 hover:bg-ink-2 hover:text-white",
  },
  atrasada: { rotulo: "Atrasada", classe: "bg-red-soft text-red hover:bg-red hover:text-white" },
  agendada: {
    rotulo: "Agendada",
    classe: "bg-orange-soft text-orange hover:bg-orange hover:text-white",
  },
  auvo_disponivel: {
    rotulo: "No Auvo",
    classe: "bg-blue-soft text-blue hover:bg-blue hover:text-white",
  },
  concluida: {
    rotulo: "Concluída",
    classe: "bg-green-soft text-green hover:bg-green hover:text-white",
  },
};

function dataDoCalendario(ocorrencia: ItemCalendarioPreventiva): string {
  return ocorrencia.visitaEm?.slice(0, 10) ?? ocorrencia.vencimento;
}

/** Calendário de planejamento; clicar sempre conduz à mesma execução no histórico abaixo. */
export function PreventivasCalendarioView({
  ocorrencias,
  onSelecionar,
  mesInicial,
}: {
  ocorrencias: ItemCalendarioPreventiva[];
  onSelecionar: (ocorrenciaId: string) => void;
  mesInicial?: Date;
}) {
  const [mesRef, setMesRef] = useState(() => {
    const base = mesInicial ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const dias = useMemo(() => gerarDiasDoMes(mesRef.getFullYear(), mesRef.getMonth()), [mesRef]);
  const ocorrenciasPorDia = useMemo(() => {
    const indice = new Map<string, ItemCalendarioPreventiva[]>();
    for (const ocorrencia of ocorrencias) {
      const data = dataDoCalendario(ocorrencia);
      indice.set(data, [...(indice.get(data) ?? []), ocorrencia]);
    }
    return indice;
  }, [ocorrencias]);
  const hoje = formatarDiaIso(new Date());

  function mudarMes(delta: number) {
    setMesRef((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            className="rounded-md border border-line p-1.5 hover:bg-line-soft"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMesRef(new Date())}
            className="rounded-md border border-line px-3 py-1.5 text-caption font-semibold hover:bg-line-soft"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => mudarMes(1)}
            className="rounded-md border border-line p-1.5 hover:bg-line-soft"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="text-body font-semibold capitalize text-ink">
          {mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line-soft">
        {DIAS_SEMANA.map((dia) => (
          <div
            key={dia}
            className="bg-paper px-2 py-1.5 text-center text-micro font-semibold text-ink-3"
          >
            {dia}
          </div>
        ))}
        {dias.map((dia) => {
          const data = formatarDiaIso(dia);
          const itens = ocorrenciasPorDia.get(data) ?? [];
          return (
            <div
              key={data}
              className={`min-h-[104px] bg-card p-1.5 ${dia.getMonth() === mesRef.getMonth() ? "" : "opacity-40"}`}
            >
              <p
                className={`text-micro font-semibold ${data === hoje ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-navy text-white" : "text-ink-3"}`}
              >
                {dia.getDate()}
              </p>
              <div className="mt-1 flex flex-col gap-0.5">
                {itens.slice(0, MAX_OCORRENCIAS_POR_DIA).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelecionar(item.id)}
                    aria-label={`${item.nomePlano}: ${ESTADO[item.estado].rotulo}`}
                    className={`w-full truncate rounded-sm px-1 py-0.5 text-left text-micro font-semibold ${ESTADO[item.estado].classe}`}
                  >
                    {item.nomePlano}
                  </button>
                ))}
                {itens.length > MAX_OCORRENCIAS_POR_DIA && (
                  <p className="text-micro text-ink-3">
                    +{itens.length - MAX_OCORRENCIAS_POR_DIA} mais
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-micro text-ink-3">
        Cores: prevista, atrasada, agendada, disponível no Auvo e concluída.
      </p>
    </div>
  );
}
