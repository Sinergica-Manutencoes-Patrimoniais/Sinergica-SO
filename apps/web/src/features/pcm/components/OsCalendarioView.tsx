import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";
import { formatarDiaIso, gerarDiasDoMes, ordensNoDia } from "../domain/ordens-servico";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_CHIPS_POR_DIA = 3;

/** E01-S38 — AC-8: visão mês, OS posicionada pela `dataAgendada`. OS sem data não aparece aqui
 * (aparece normalmente nas outras visões). */
export function OsCalendarioView({
  ordens,
  onSelecionar,
}: {
  ordens: OrdemServicoOperacional[];
  onSelecionar: (id: string) => void;
}) {
  const [mesRef, setMesRef] = useState(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });

  const dias = useMemo(() => gerarDiasDoMes(mesRef.getFullYear(), mesRef.getMonth()), [mesRef]);
  const hojeIso = formatarDiaIso(new Date());

  function mudarMes(deltaMeses: number) {
    setMesRef((atual) => new Date(atual.getFullYear(), atual.getMonth() + deltaMeses, 1));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            className="rounded-[6px] border border-line p-1.5 hover:bg-line-soft"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              setMesRef(() => {
                const hoje = new Date();
                return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
              })
            }
            className="rounded-[6px] border border-line px-3 py-1.5 text-xs font-semibold hover:bg-line-soft"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => mudarMes(1)}
            className="rounded-[6px] border border-line p-1.5 hover:bg-line-soft"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm font-semibold capitalize text-ink">
          {mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[8px] border border-line bg-line-soft">
        {DIAS_SEMANA.map((rotulo) => (
          <div
            key={rotulo}
            className="bg-paper px-2 py-1.5 text-center text-[11px] font-semibold text-ink-3"
          >
            {rotulo}
          </div>
        ))}
        {dias.map((dia) => {
          const diaIso = formatarDiaIso(dia);
          const doMesAtual = dia.getMonth() === mesRef.getMonth();
          const ordensDoDia = ordensNoDia(ordens, diaIso);
          return (
            <div
              key={diaIso}
              className={`min-h-[92px] bg-card p-1.5 ${doMesAtual ? "" : "opacity-40"}`}
            >
              <p
                className={`text-[11px] font-semibold ${
                  diaIso === hojeIso
                    ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-navy text-white"
                    : "text-ink-3"
                }`}
              >
                {dia.getDate()}
              </p>
              <div className="mt-1 flex flex-col gap-0.5">
                {ordensDoDia.slice(0, MAX_CHIPS_POR_DIA).map((ordem) => (
                  <button
                    key={ordem.id}
                    type="button"
                    onClick={() => onSelecionar(ordem.id)}
                    title={`${ordem.numero} · ${ordem.titulo}`}
                    className="truncate rounded-[3px] bg-line-soft px-1 py-0.5 text-left text-[10px] font-semibold text-ink-2 hover:bg-navy hover:text-white"
                  >
                    {ordem.numero}
                  </button>
                ))}
                {ordensDoDia.length > MAX_CHIPS_POR_DIA && (
                  <p className="text-[10px] text-ink-3">
                    +{ordensDoDia.length - MAX_CHIPS_POR_DIA} mais
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
